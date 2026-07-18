import { useState, useRef, useEffect } from 'react'
import ChatMessage from './ChatMessage'
import MessageInput from './MessageInput'
import './ChatArea.css'

export default function ChatArea() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'bot',
      content: 'Hello! I am Nexus AI. How can I help you today?',
    }
  ])
  
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (content) => {
    // Add user message
    const newUserMessage = {
      id: Date.now(),
      role: 'user',
      content
    }
    
    setMessages(prev => [...prev, newUserMessage])

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: content, history: messages })
      })

      const data = await response.json()

      const botResponse = {
        id: Date.now() + 1,
        role: 'bot',
        content: data.response || data.error || 'Unknown error occurred.'
      }
      
      setMessages(prev => [...prev, botResponse])
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorResponse = {
        id: Date.now() + 1,
        role: 'bot',
        content: 'Error: Could not connect to the local backend server. Make sure it is running on port 3001.'
      }
      setMessages(prev => [...prev, errorResponse])
    }
  }

  return (
    <div className="chat-area">
      <div className="messages-container">
        <div className="messages-list">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="input-region">
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  )
}
