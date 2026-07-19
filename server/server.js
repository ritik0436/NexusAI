import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { GoogleGenerativeAI } from '@google/generative-ai'

dotenv.config()

const app = express()
const port = 3001

// Middleware
app.use(cors())
app.use(express.json())

// Initialize Gemini SDK
let genAI = null
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

// ---------------------------------------------------------------------------
// Model priority list — these are the models most likely to give clean,
// chat-friendly answers on a free-tier key. We try them in order.
// ---------------------------------------------------------------------------
const PREFERRED_MODELS = [
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemma-3-27b-it',
  'gemma-4-31b-it',
]

// ---------------------------------------------------------------------------
// Clean up "thinking model" artifacts from the response text.
// Some models (especially Gemma) leak their internal chain-of-thought,
// draft attempts, constraint lists, etc. This strips all of that out so
// the user only sees the final, clean answer.
// ---------------------------------------------------------------------------
function cleanResponse(raw) {
  let text = raw

  // 1. Strip <think>…</think> blocks (Gemma-style thinking tokens)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '')

  // 2. Strip lines that look like internal reasoning / drafts
  //    e.g. "* Role: …", "* Style: …", "* Constraints: …", "* Draft 1: …"
  text = text.replace(/^\s*\*\s*(Role|Style|Constraints?|Draft\s*\d*|User Prompt):.*$/gim, '')

  // 3. Strip "Thinking" / "Reasoning" / "Let me think" preamble blocks
  text = text.replace(/^(Thinking|Reasoning|Let me think|Here'?s my (thought|reasoning) process)[\s\S]*?(?=\n[A-Z])/gi, '')

  // 4. Collapse multiple blank lines into one
  text = text.replace(/\n{3,}/g, '\n\n')

  // 5. If there are multiple near-identical sentences, keep only the last one
  //    e.g. "The capital is New Delhi.The capital is **New Delhi**."
  const sentences = text.split(/(?<=[.!?])\s*/).filter(s => s.trim())
  if (sentences.length > 1) {
    // Normalize for comparison (strip markdown bold, lowercase)
    const normalize = s => s.replace(/\*\*/g, '').toLowerCase().trim()
    const unique = []
    const seen = new Set()
    // Walk backwards so the last (usually best-formatted) version wins
    for (let i = sentences.length - 1; i >= 0; i--) {
      const key = normalize(sentences[i])
      if (!seen.has(key)) {
        seen.add(key)
        unique.unshift(sentences[i])
      }
    }
    text = unique.join(' ')
  }

  return text.trim()
}

// ---------------------------------------------------------------------------
// Resolve which models to try: start with our preferred list (filtered to
// what the key actually has access to), then append any remaining models.
// ---------------------------------------------------------------------------
async function getOrderedModels() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  )
  const data = await res.json()
  const all = (data.models || [])
    .filter(m =>
      m.supportedGenerationMethods?.includes('generateContent') &&
      !m.name.includes('embedding') &&
      !m.name.includes('imagen') &&
      !m.name.includes('veo') &&
      !m.name.includes('lyria') &&
      !m.name.includes('banana') &&
      !m.name.includes('tts') &&
      !m.name.includes('audio') &&
      !m.name.includes('robotics') &&
      !m.name.includes('computer-use')
    )
    .map(m => m.name.replace('models/', ''))

  // Build ordered list: preferred first, then the rest
  const ordered = []
  for (const pref of PREFERRED_MODELS) {
    if (all.includes(pref)) ordered.push(pref)
  }
  for (const m of all) {
    if (!ordered.includes(m)) ordered.push(m)
  }
  return ordered
}

// ---------------------------------------------------------------------------
// Chat endpoint
// ---------------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (!genAI) {
      return res.json({
        response:
          "I'm running in local mode! To get real AI responses, add your free GEMINI_API_KEY to server/.env and restart the backend.",
      })
    }

    const models = await getOrderedModels()

    let text = null
    let lastError = null

    for (const modelName of models) {
      try {
        console.log(`Trying model: ${modelName}`)
        const model = genAI.getGenerativeModel({ model: modelName })

        // Send the user's message directly — no wrapper prompt.
        // Wrapper prompts cause thinking models to echo the instructions.
        const result = await model.generateContent(message)
        const response = await result.response
        text = cleanResponse(response.text())

        console.log(`✓ Success with: ${modelName}`)
        break
      } catch (e) {
        console.log(`✗ ${modelName}: ${e.message.substring(0, 120)}`)
        lastError = e
      }
    }

    if (text === null) {
      throw lastError || new Error('No available model could generate a response.')
    }

    res.json({ response: text })
  } catch (error) {
    console.error('Gemini API error:', error.message)
    res.status(500).json({ error: 'Failed to generate response. Please try again.' })
  }
})

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`)
})
