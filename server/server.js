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
// Note: This requires a valid API key in the .env file
let genAI = null
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (!genAI) {
      // Fallback if API key is missing
      return res.json({ 
        response: "I'm running in local mode! To get real AI responses, please add your free GEMINI_API_KEY to the server/.env file and restart the backend." 
      })
    }

    // Dynamically fetch available models
    const modelRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const modelData = await modelRes.json();
    const availableModels = modelData.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent') && !m.name.includes('embedding'))
      .map(m => m.name.replace('models/', ''))
      // Sort to try newer/stable models first, but fallback to any
      .sort((a, b) => b.localeCompare(a));

    let text = null;
    let lastError = null;
    let successfulModelName = null;

    // Try models one by one until one works
    for (const modelName of availableModels) {
      try {
        console.log(`Trying AI model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const optimizedPrompt = `Answer the following question directly and concisely in a single sentence without any filler words:\n\n${message}`;

        const result = await model.generateContent(optimizedPrompt);
        const response = await result.response;
        text = response.text();
        successfulModelName = modelName;
        break; // Success! Stop iterating.
      } catch (e) {
        console.log(`Model ${modelName} failed: ${e.message.split('\\n')[0]}`);
        lastError = e;
      }
    }

    if (text === null) {
      throw lastError || new Error("None of the available models worked for generateContent.");
    }

    console.log(`Successfully generated response using: ${successfulModelName}`);
    res.json({ response: text })

  } catch (error) {
    console.error('Error calling Gemini API:', error.message)
    res.status(500).json({ error: 'Failed to generate response: ' + error.message })
  }
})

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`)
})
