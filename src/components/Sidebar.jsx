import { useState, useEffect } from 'react'
import './Sidebar.css'

function groupChatsByDate(chats) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000)

  const groups = { Today: [], 'Previous 7 Days': [], Older: [] }
  chats.forEach(chat => {
    const d = new Date(chat.created_at)
    if (d >= today) groups['Today'].push(chat)
    else if (d >= weekAgo) groups['Previous 7 Days'].push(chat)
    else groups['Older'].push(chat)
  })
  return groups
}

export default function Sidebar({
  onNavigate, currentView, isOpen, onClose,
  token, user, onLogout, onNewChat, activeChatId, onSelectChat, refreshKey
}) {
  const [chats, setChats] = useState([])
  const [loadingChats, setLoadingChats] = useState(false)

  const fetchChats = async () => {
    if (!token) return
    setLoadingChats(true)
    try {
      const res = await fetch('http://localhost:3001/api/chats', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.chats) setChats(data.chats)
    } catch (e) {
      console.error('Failed to load chats:', e)
    } finally {
      setLoadingChats(false)
    }
  }

  useEffect(() => { fetchChats() }, [token, refreshKey])

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation()
    try {
      await fetch(`http://localhost:3001/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      setChats(prev => prev.filter(c => c.id !== chatId))
      if (activeChatId === chatId) onNewChat()
    } catch (e) {
      console.error('Failed to delete chat:', e)
    }
  }

  const groups = groupChatsByDate(chats)
  const initials = user?.username ? user.username[0].toUpperCase() : 'U'

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}

      <aside className={`sidebar glass-panel ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-dot"></div>
            <h2>Nexus AI</h2>
          </div>
          <button className="close-sidebar-btn" onClick={onClose} aria-label="Close Sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="new-chat-container">
          <button className="new-chat-btn" onClick={onNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            New Chat
          </button>
        </div>

        <div className="sidebar-content">
          {loadingChats ? (
            <div className="chats-loading">
              <div className="loading-dots"><span></span><span></span><span></span></div>
            </div>
          ) : chats.length === 0 ? (
            <div className="chats-empty">
              <p>No conversations yet.</p>
              <p>Start a new chat!</p>
            </div>
          ) : (
            Object.entries(groups).map(([label, groupChats]) =>
              groupChats.length > 0 && (
                <div className="history-group" key={label}>
                  <h3 className="history-title">{label}</h3>
                  <ul className="history-list">
                    {groupChats.map(chat => (
                      <li
                        key={chat.id}
                        className={`history-item ${chat.id === activeChatId ? 'active' : ''}`}
                        onClick={() => onSelectChat(chat.id)}
                        title={chat.title}
                      >
                        <span className="history-item-title">{chat.title}</span>
                        <button
                          className="history-delete-btn"
                          onClick={(e) => handleDeleteChat(e, chat.id)}
                          title="Delete chat"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )
          )}
        </div>

        <div className="sidebar-footer">
          <div className="footer-actions">
            <div
              className={`user-profile ${currentView === 'profile' ? 'active-nav' : ''}`}
              onClick={() => onNavigate('profile')}
            >
              <div className="avatar">{initials}</div>
              <div className="user-info">
                <span className="user-name">{user?.username || 'User'}</span>
                <span className="user-status">{user?.email || ''}</span>
              </div>
            </div>

            <div className="footer-icons">
              <button
                className={`settings-btn ${currentView === 'settings' ? 'active-icon' : ''}`}
                onClick={() => onNavigate('settings')}
                title="Settings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>

              <button className="logout-btn" onClick={onLogout} title="Sign out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
