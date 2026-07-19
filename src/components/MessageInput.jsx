import { useState, useRef } from 'react'
import './MessageInput.css'

export default function MessageInput({ onSendMessage, attachedFiles, setAttachedFiles }) {
  const [message, setMessage] = useState('')
  const fileInputRef = useRef(null)

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

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      setAttachedFiles(prev => [...prev, ...files])
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
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
              <button
                type="button"
                className="file-chip-remove"
                onClick={() => removeFile(index)}
                title="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <form className="input-form" onSubmit={handleSubmit}>
        <div className="input-left-icons">
          <button type="button" className="icon-btn" title="AI Features">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button type="button" className="icon-btn" title="Attach file" onClick={handleAttachClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.44 11.05l-9.19 9.19a6.003 6.003 0 11-8.49-8.49l9.19-9.19a4.002 4.002 0 015.66 5.66l-9.2 9.19a2.001 2.001 0 11-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.js,.py,.html,.css"
        />
        
        <textarea
          className="message-textarea"
          placeholder="Ask Nexus AI anything..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        
        <button 
          type="submit" 
          className={`send-button ${message.trim() || attachedFiles.length > 0 ? 'active' : ''}`}
          disabled={!message.trim() && attachedFiles.length === 0}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
