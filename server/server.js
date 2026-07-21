import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createRequire } from 'module'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
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

const EFFECTIVE_JWT_SECRET = process.env.JWT_SECRET || 'nexus-ai-dev-secret-do-not-use-in-prod'
if (!process.env.JWT_SECRET) console.warn('⚠️  JWT_SECRET not set — using insecure fallback!')

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: Origin '${origin}' not allowed`))
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.use(express.json({ limit: '50kb' }))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

// ─── Rate limiter ──────────────────────────────────────────────────────────────
const rateLimitMap = new Map()
function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown'
    const now = Date.now()
    const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs }
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs }
    entry.count++
    rateLimitMap.set(ip, entry)
    if (entry.count > maxRequests) return res.status(429).json({ error: 'Too many requests. Please slow down.' })
    next()
  }
}

// ─── Email (nodemailer / Gmail) ───────────────────────────────────────────────
let transporter = null
const emailConfigured = process.env.SMTP_USER && process.env.SMTP_PASS &&
  !process.env.SMTP_USER.includes('your-gmail')

if (emailConfigured) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  transporter.verify()
    .then(() => console.log('✓ Email (Gmail SMTP) ready'))
    .catch(e => console.warn('⚠️  Email transport error:', e.message))
} else {
  console.warn('⚠️  SMTP_USER/SMTP_PASS not configured — OTP codes will be printed to console.')
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendVerificationEmail(toEmail, username, code) {
  if (!transporter) {
    console.log(`\n📧 [DEV MODE] Verification code for ${toEmail}: ${code}\n`)
    return
  }
  await transporter.sendMail({
    from: `"Nexus AI" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Verify your Nexus AI account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="background: linear-gradient(to right, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 8px;">Nexus AI</h2>
        <p style="color: #64748b; margin: 0 0 24px;">Welcome, ${username}! Verify your email to get started.</p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">Your verification code</p>
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #0f172a;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">This code expires in <strong>15 minutes</strong>. If you didn't sign up, ignore this email.</p>
      </div>
    `,
  })
}

// ─── Database ──────────────────────────────────────────────────────────────────
let db
const SQL = await initSqlJs()

if (fs.existsSync(DB_PATH)) {
  db = new SQL.Database(fs.readFileSync(DB_PATH))
  console.log('✓ Loaded existing database:', DB_PATH)
} else {
  db = new SQL.Database()
  console.log('✓ Created new database:', DB_PATH)
}

function saveDb() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
}
setInterval(saveDb, 10000)
process.on('exit', saveDb)
process.on('SIGINT', () => { saveDb(); process.exit() })
process.on('SIGTERM', () => { saveDb(); process.exit() })

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    otp_code TEXT,
    otp_expires_at TEXT,
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

// Migrate existing users table if verified column doesn't exist
try {
  db.run(`ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0`)
  db.run(`ALTER TABLE users ADD COLUMN otp_code TEXT`)
  db.run(`ALTER TABLE users ADD COLUMN otp_expires_at TEXT`)
  // Mark existing users as verified so they aren't locked out
  db.run(`UPDATE users SET verified = 1 WHERE verified IS NULL OR verified = 0`)
  console.log('✓ Migrated users table with verification columns')
} catch {
  // Columns already exist — fine
}
saveDb()

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}
function dbGet(sql, params = []) { return dbAll(sql, params)[0] || null }
function dbRun(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.run(params)
  stmt.free()
  return db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0]
}

function sanitizeString(str, maxLen = 255) {
  if (typeof str !== 'string') return ''
  return str.trim().slice(0, maxLen)
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' })
  try {
    req.user = jwt.verify(auth.slice(7), EFFECTIVE_JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
let genAI = null
if (process.env.GEMINI_API_KEY) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

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

// ─── Auth Routes ───────────────────────────────────────────────────────────────
const authLimiter = rateLimit(15 * 60 * 1000, 10)

// REGISTER — creates unverified account, sends OTP
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const username = sanitizeString(req.body.username, 50)
    const email = sanitizeString(req.body.email, 255).toLowerCase()
    const password = typeof req.body.password === 'string' ? req.body.password : ''

    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required' })
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Invalid email format' })
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    if (password.length > 128)
      return res.status(400).json({ error: 'Password too long' })
    if (username.length < 2)
      return res.status(400).json({ error: 'Username must be at least 2 characters' })

    const existing = dbGet('SELECT id, verified FROM users WHERE email = ?', [email])
    if (existing && existing.verified) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const otp = generateOTP()
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const password_hash = await bcrypt.hash(password, 12)

    if (existing && !existing.verified) {
      // Resend OTP to existing unverified account
      dbRun('UPDATE users SET otp_code = ?, otp_expires_at = ?, password_hash = ?, username = ? WHERE email = ?',
        [otp, otpExpires, password_hash, username, email])
    } else {
      dbRun('INSERT INTO users (username, email, password_hash, verified, otp_code, otp_expires_at) VALUES (?, ?, ?, 0, ?, ?)',
        [username, email, password_hash, otp, otpExpires])
    }
    saveDb()

    await sendVerificationEmail(email, username, otp)
    res.json({ needsVerification: true, email, message: 'Verification code sent to your email.' })
  } catch (e) {
    console.error('Register error:', e.message)
    res.status(500).json({ error: 'Registration failed. Check your email configuration.' })
  }
})

// VERIFY OTP
app.post('/api/auth/verify', authLimiter, (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 255).toLowerCase()
    const code = sanitizeString(req.body.code, 10)

    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' })

    const user = dbGet('SELECT * FROM users WHERE email = ?', [email])
    if (!user) return res.status(404).json({ error: 'Account not found' })
    if (user.verified) return res.status(400).json({ error: 'Account already verified' })

    if (!user.otp_code || user.otp_code !== code)
      return res.status(400).json({ error: 'Incorrect verification code' })

    if (new Date(user.otp_expires_at) < new Date())
      return res.status(400).json({ error: 'Code has expired. Please register again to get a new code.' })

    dbRun('UPDATE users SET verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE email = ?', [email])
    saveDb()

    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, EFFECTIVE_JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } })
  } catch (e) {
    console.error('Verify error:', e.message)
    res.status(500).json({ error: 'Verification failed' })
  }
})

// RESEND OTP
app.post('/api/auth/resend', authLimiter, async (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 255).toLowerCase()
    const user = dbGet('SELECT * FROM users WHERE email = ?', [email])
    if (!user) return res.status(404).json({ error: 'Account not found' })
    if (user.verified) return res.status(400).json({ error: 'Account already verified' })

    const otp = generateOTP()
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    dbRun('UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE email = ?', [otp, otpExpires, email])
    saveDb()

    await sendVerificationEmail(email, user.username, otp)
    res.json({ message: 'New verification code sent.' })
  } catch (e) {
    console.error('Resend error:', e.message)
    res.status(500).json({ error: 'Failed to resend code' })
  }
})

// LOGIN — only verified users can log in
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 255).toLowerCase()
    const password = typeof req.body.password === 'string' ? req.body.password : ''

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const user = dbGet('SELECT * FROM users WHERE email = ?', [email])
    const dummyHash = '$2b$12$invalidhashfortimingprotection0000000000000000000000'
    const valid = user ? await bcrypt.compare(password, user.password_hash) : await bcrypt.compare(password, dummyHash)

    if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password' })

    if (!user.verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.', needsVerification: true, email })
    }

    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, EFFECTIVE_JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } })
  } catch (e) {
    console.error('Login error:', e.message)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ─── Chat Routes ───────────────────────────────────────────────────────────────
app.get('/api/chats', requireAuth, (req, res) => {
  const chats = dbAll('SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC', [req.user.id])
  res.json({ chats })
})

app.post('/api/chats', requireAuth, (req, res) => {
  const title = sanitizeString(req.body.title || 'New Chat', 100)
  const id = dbRun('INSERT INTO chats (user_id, title) VALUES (?, ?)', [req.user.id, title])
  saveDb()
  res.json({ chat: dbGet('SELECT * FROM chats WHERE id = ?', [id]) })
})

app.patch('/api/chats/:id', requireAuth, (req, res) => {
  const chat = dbGet('SELECT * FROM chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  if (!chat) return res.status(404).json({ error: 'Chat not found' })
  dbRun('UPDATE chats SET title = ? WHERE id = ?', [sanitizeString(req.body.title || 'New Chat', 100), req.params.id])
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
  const messages = dbAll('SELECT id, role, content, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC', [req.params.id])
  res.json({ messages })
})

const chatLimiter = rateLimit(60 * 1000, 30)
app.post('/api/chat', requireAuth, chatLimiter, async (req, res) => {
  try {
    const { chatId } = req.body
    const message = sanitizeString(req.body.message || '', 4000)
    if (!message || !chatId) return res.status(400).json({ error: 'message and chatId required' })

    const chat = dbGet('SELECT * FROM chats WHERE id = ? AND user_id = ?', [chatId, req.user.id])
    if (!chat) return res.status(403).json({ error: 'Access denied' })

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
      const model = genAI.getGenerativeModel({ model: cachedModelName, systemInstruction: SYSTEM_INSTRUCTION, generationConfig: { thinkingConfig: { thinkingBudget: 1024 } } })
      text = extractFinalAnswer((await model.generateContent(message)).response)
    } catch {
      cachedModelName = await discoverWorkingModel()
      const model = genAI.getGenerativeModel({ model: cachedModelName, systemInstruction: SYSTEM_INSTRUCTION })
      text = extractFinalAnswer((await model.generateContent(message)).response)
    }

    dbRun('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'bot', text])
    if (chat.title === 'New Chat') {
      dbRun('UPDATE chats SET title = ? WHERE id = ?', [message.slice(0, 50) + (message.length > 50 ? '...' : ''), chatId])
    }
    saveDb()
    res.json({ response: text })
  } catch (error) {
    console.error('Chat error:', error.message)
    res.status(500).json({ error: 'Failed to generate response. Please try again.' })
  }
})

app.use((req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`)
  if (genAI) discoverWorkingModel().then(n => { cachedModelName = n }).catch(console.error)
})
