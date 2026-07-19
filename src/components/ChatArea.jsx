import { useState, useRef, useEffect } from 'react'
import ChatMessage from './ChatMessage'
import MessageInput from './MessageInput'
import './ChatArea.css'

export default function ChatArea({ token, activeChatId, onChatCreated }) {
  const [messages, setMessages] = useState([])
  const [attachedFiles, setAttachedFiles] = useState([])
  const [currentChatId, setCurrentChatId] = useState(activeChatId)
  const [loading, setLoading] = useState(false)

  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (messages.length > 0) scrollToBottom()
  }, [messages])

  // When activeChatId changes externally (sidebar click), load that chat
  useEffect(() => {
    if (activeChatId && activeChatId !== currentChatId) {
      setCurrentChatId(activeChatId)
      loadChatMessages(activeChatId)
    } else if (!activeChatId && currentChatId) {
      // New chat requested
      setCurrentChatId(null)
      setMessages([])
    }
  }, [activeChatId])

  const loadChatMessages = async (chatId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content
        })))
      }
    } catch (e) {
      console.error('Failed to load messages:', e)
    }
  }

  const handleSendMessage = async (content) => {
    if (!content.trim() && attachedFiles.length === 0) return

    let chatId = currentChatId

    // Create a new chat if we don't have one yet
    if (!chatId) {
      try {
        const res = await fetch('http://localhost:3001/api/chats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ title: 'New Chat' })
        })
        const data = await res.json()
        chatId = data.chat.id
        setCurrentChatId(chatId)
        onChatCreated(chatId)
      } catch {
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          content: 'Error: Could not create chat. Is the backend running?'
        }])
        return
      }
    }

    // Display user message immediately
    let displayContent = content
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => `📎 ${f.name}`).join('\n')
      displayContent = `${fileNames}\n\n${content}`
    }
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: displayContent }])
    setAttachedFiles([])
    setLoading(true)

    // Typing indicator
    const typingId = Date.now() + 1
    setMessages(prev => [...prev, { id: typingId, role: 'bot', content: '...', isTyping: true }])

    try {
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: content, chatId })
      })
      const data = await res.json()

      setMessages(prev => prev.filter(m => m.id !== typingId))
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        role: 'bot',
        content: data.response || data.error || 'Unknown error occurred.'
      }])
    } catch {
      setMessages(prev => prev.filter(m => m.id !== typingId))
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        role: 'bot',
        content: 'Error: Could not reach the backend server.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className={`chat-area ${isEmpty ? 'centered-layout' : 'active-layout'}`}>
      {/* Animated background orbs */}
      <div className="bg-animation" aria-hidden="true">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
      </div>

      {isEmpty ? (
        <div className="hero-section animate-slide-up">
          <div className="hero-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 4V44M4 24H44" stroke="url(#heroGrad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="heroGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>What can I help you with?</h1>
        </div>
      ) : (
        <div className="messages-container">
          <div className="messages-list">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      <div className="input-region">
        <MessageInput
          onSendMessage={handleSendMessage}
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
          disabled={loading}
        />
        {isEmpty && <p className="footer-credits">© 2026 Nexus AI</p>}
      </div>
    </div>
  )
}
