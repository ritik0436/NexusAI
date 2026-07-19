import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createRequire } from 'module'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

dotenv.config()

const require = createRequire(import.meta.url)
const initSqlJs = require('sql.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'nexus.db')

const app = express()
const port = 3001
const JWT_SECRET = process.env.JWT_SECRET || 'nexus-ai-secret-key-2026'

app.use(cors())
app.use(express.json())

// ─── Database Setup ───────────────────────────────────────────────────────────
let db
const SQL = await initSqlJs()

if (fs.existsSync(DB_PATH)) {
  const fileBuffer = fs.readFileSync(DB_PATH)
  db = new SQL.Database(fileBuffer)
  console.log('✓ Loaded existing database:', DB_PATH)
} else {
  db = new SQL.Database()
  console.log('✓ Created new database:', DB_PATH)
}

// Save DB to disk on exit and periodically
function saveDb() {
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}
setInterval(saveDb, 10000) // Auto-save every 10s
process.on('exit', saveDb)
process.on('SIGINT', () => { saveDb(); process.exit() })
process.on('SIGTERM', () => { saveDb(); process.exit() })

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id)
  );
`)
saveDb()

// Helper: run a query and get rows as objects
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function dbGet(sql, params = []) {
  return dbAll(sql, params)[0] || null
}

function dbRun(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.run(params)
  stmt.free()
  return db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0]
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── Gemini Setup ─────────────────────────────────────────────────────────────
let genAI = null
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

const SYSTEM_INSTRUCTION = `You are Nexus AI. Reply directly and concisely. Never show reasoning, drafts, bullet-point options, or internal notes. Just give the final answer.`

let cachedModelName = null

function cleanResponse(raw) {
  let text = raw
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  text = text.replace(/^\s*[\*\-]\s*(Role|Persona|Style|Constraints?|Draft\s*\d*|User\s*(Prompt|Message)):.*$/gim, '')
  text = text.replace(/^.*(The user (said|asked|wants|is asking)|I should|I need to).*$/gim, '')
  text = text.replace(/\n{3,}/g, '\n\n')
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 2)
  if (sentences.length > 1) {
    const normalize = s => s.replace(/\*\*/g, '').toLowerCase().trim()
    const unique = [], seen = new Set()
    for (let i = sentences.length - 1; i >= 0; i--) {
      const key = normalize(sentences[i])
      if (!seen.has(key)) { seen.add(key); unique.unshift(sentences[i]) }
    }
    text = unique.join(' ')
  }
  return text.trim()
}

function extractFinalAnswer(response) {
  try {
    const parts = response.candidates?.[0]?.content?.parts || []
    const answerParts = parts.filter(p => !p.thought)
    const text = answerParts.map(p => p.text || '').join('')
    if (text.trim()) return cleanResponse(text)
  } catch {}
  return cleanResponse(response.text())
}

async function discoverWorkingModel() {
  console.log('🔍 Discovering models...')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`)
  const data = await res.json()
  const all = (data.models || [])
    .filter(m => m.supportedGenerationMethods?.includes('generateContent') &&
      !['embedding','imagen','veo','lyria','tts','audio','robotics','computer-use'].some(x => m.name.includes(x)))
    .map(m => m.name.replace('models/', ''))
  for (const name of [...all.filter(m => m.startsWith('gemini-')), ...all.filter(m => !m.startsWith('gemini-'))]) {
    try {
      await genAI.getGenerativeModel({ model: name }).generateContent('Hi')
      console.log(`✓ Working model: ${name}`)
      return name
    } catch { console.log(`✗ ${name}`) }
  }
  throw new Error('No working model found.')
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required' })
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    if (dbGet('SELECT id FROM users WHERE email = ?', [email]))
      return res.status(409).json({ error: 'Email already registered' })

    const password_hash = await bcrypt.hash(password, 10)
    const id = dbRun('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, password_hash])
    saveDb()
    const token = jwt.sign({ id, username, email }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: { id, username, email } })
  } catch (e) {
    console.error('Register error:', e.message)
    res.status(500).json({ error: 'Registration failed' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' })
    const user = dbGet('SELECT * FROM users WHERE email = ?', [email])
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' })
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } })
  } catch (e) {
    console.error('Login error:', e.message)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ─── Chat History Routes ──────────────────────────────────────────────────────
app.get('/api/chats', requireAuth, (req, res) => {
  const chats = dbAll('SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC', [req.user.id])
  res.json({ chats })
})

app.post('/api/chats', requireAuth, (req, res) => {
  const { title } = req.body
  const id = dbRun('INSERT INTO chats (user_id, title) VALUES (?, ?)', [req.user.id, title || 'New Chat'])
  saveDb()
  const chat = dbGet('SELECT * FROM chats WHERE id = ?', [id])
  res.json({ chat })
})

app.patch('/api/chats/:id', requireAuth, (req, res) => {
  const chat = dbGet('SELECT * FROM chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  if (!chat) return res.status(404).json({ error: 'Chat not found' })
  dbRun('UPDATE chats SET title = ? WHERE id = ?', [req.body.title, req.params.id])
  saveDb()
  res.json({ success: true })
})

app.delete('/api/chats/:id', requireAuth, (req, res) => {
  const chat = dbGet('SELECT * FROM chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  if (!chat) return res.status(404).json({ error: 'Chat not found' })
  dbRun('DELETE FROM messages WHERE chat_id = ?', [req.params.id])
  dbRun('DELETE FROM chats WHERE id = ?', [req.params.id])
  saveDb()
  res.json({ success: true })
})

app.get('/api/chats/:id/messages', requireAuth, (req, res) => {
  const chat = dbGet('SELECT * FROM chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  if (!chat) return res.status(404).json({ error: 'Chat not found' })
  const messages = dbAll('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC', [req.params.id])
  res.json({ messages })
})

// ─── Main Chat Endpoint ───────────────────────────────────────────────────────
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, chatId } = req.body
    if (!message || !chatId) return res.status(400).json({ error: 'message and chatId required' })

    dbRun('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'user', message])

    if (!genAI) {
      const botMsg = "Add your GEMINI_API_KEY to server/.env to enable AI responses."
      dbRun('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'bot', botMsg])
      saveDb()
      return res.json({ response: botMsg })
    }

    if (!cachedModelName) cachedModelName = await discoverWorkingModel()

    let text
    try {
      const model = genAI.getGenerativeModel({
        model: cachedModelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: { thinkingConfig: { thinkingBudget: 1024 } },
      })
      text = extractFinalAnswer((await model.generateContent(message)).response)
    } catch {
      cachedModelName = await discoverWorkingModel()
      const model = genAI.getGenerativeModel({ model: cachedModelName, systemInstruction: SYSTEM_INSTRUCTION })
      text = extractFinalAnswer((await model.generateContent(message)).response)
    }

    dbRun('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'bot', text])

    // Auto-title from first message
    const chatData = dbGet('SELECT * FROM chats WHERE id = ?', [chatId])
    if (chatData?.title === 'New Chat') {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '')
      dbRun('UPDATE chats SET title = ? WHERE id = ?', [title, chatId])
    }
    saveDb()

    res.json({ response: text })
  } catch (error) {
    console.error('Chat error:', error.message)
    res.status(500).json({ error: 'Failed to generate response. Please try again.' })
  }
})

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`)
  if (genAI) discoverWorkingModel().then(n => { cachedModelName = n }).catch(console.error)
})
