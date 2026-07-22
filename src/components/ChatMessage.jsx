import { useState, useRef } from 'react'
import './ChatMessage.css'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef(null)

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(message.content)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }

  return (
    <div className={`message-wrapper ${isUser ? 'user' : 'bot'} animate-slide-up`}>
      {!isUser && (
        <div className="message-avatar bot-avatar">
          <div className="bot-icon"></div>
        </div>
      )}
      
      <div className="message-content">
        <div className="message-sender">{isUser ? 'You' : 'Nexus AI'}</div>
        <div className="message-bubble">
          <p>{message.content}</p>

          {/* Text-to-Speech button (bot messages only) */}
          {!isUser && !message.isTyping && (
            <button
              className={`tts-btn ${isSpeaking ? 'speaking' : ''}`}
              onClick={handleSpeak}
              title={isSpeaking ? 'Stop' : 'Listen'}
            >
              {isSpeaking ? (
                <>
                  <div className="tts-eq">
                    <span></span><span></span><span></span><span></span>
                  </div>
                  Stop
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Listen
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="message-avatar user-avatar">
          U
        </div>
      )}
    </div>
  )
}
