import './ChatMessage.css'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

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
