import { useState, useRef } from 'react'
import './MessageInput.css'

export default function MessageInput({ onSendMessage, attachedFiles, setAttachedFiles }) {
  const [message, setMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() || attachedFiles.length > 0) {
      onSendMessage(message)
      setMessage('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleAttachClick = () => fileInputRef.current?.click()

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) setAttachedFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // ── Voice Recording (Web Speech API) ──────────────────
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Try Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = true
    recognitionRef.current = recognition

    recognition.onresult = (e) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setMessage(transcript)
    }

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  const toggleVoice = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  return (
    <div className="input-container">
      {/* Attached file chips */}
      {attachedFiles.length > 0 && (
        <div className="attached-files">
          {attachedFiles.map((file, index) => (
            <div key={index} className="file-chip">
              <span className="file-chip-icon">📎</span>
              <span className="file-chip-name">{file.name}</span>
              <button type="button" className="file-chip-remove" onClick={() => removeFile(index)} title="Remove file">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Voice recording overlay */}
      {isRecording && (
        <div className="voice-overlay">
          <div className="voice-visualizer">
            <div className="voice-ring ring-1"></div>
            <div className="voice-ring ring-2"></div>
            <div className="voice-ring ring-3"></div>
            <div className="voice-mic-center" onClick={stopRecording}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="white"/>
              </svg>
            </div>
          </div>
          <div className="voice-bars">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="voice-bar" style={{ animationDelay: `${i * 0.08}s` }}></div>
            ))}
          </div>
          <p className="voice-label">Listening...</p>
          <p className="voice-hint">Tap the square to stop</p>
        </div>
      )}

      <form className="input-form" onSubmit={handleSubmit}>
        <div className="input-left-icons">
          <button type="button" className="icon-btn" title="Attach file" onClick={handleAttachClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21.44 11.05l-9.19 9.19a6.003 6.003 0 11-8.49-8.49l9.19-9.19a4.002 4.002 0 015.66 5.66l-9.2 9.19a2.001 2.001 0 11-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.js,.py,.html,.css" />
        
        <textarea
          className="message-textarea"
          placeholder="Ask Nexus AI anything..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        {/* Voice button */}
        <button
          type="button"
          className={`icon-btn voice-btn ${isRecording ? 'recording' : ''}`}
          onClick={toggleVoice}
          title={isRecording ? 'Stop recording' : 'Voice input'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        
        <button 
          type="submit" 
          className={`send-button ${message.trim() || attachedFiles.length > 0 ? 'active' : ''}`}
          disabled={!message.trim() && attachedFiles.length === 0}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
