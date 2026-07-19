import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import Settings from './components/Settings'
import Profile from './components/Profile'
import AuthPage from './components/AuthPage'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('chat')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [theme, setTheme] = useState('light')
  const [token, setToken] = useState(() => localStorage.getItem('nexus_token'))
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nexus_user')) } catch { return null }
  })
  const [activeChatId, setActiveChatId] = useState(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleAuth = (newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
  }

  const handleLogout = () => {
    localStorage.removeItem('nexus_token')
    localStorage.removeItem('nexus_user')
    setToken(null)
    setUser(null)
    setActiveChatId(null)
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

  const handleNewChat = () => {
    setActiveChatId(null)
    setCurrentView('chat')
  }

  const handleChatCreated = (chatId) => {
    setActiveChatId(chatId)
    // Refresh sidebar to show new chat
    setSidebarRefreshKey(k => k + 1)
  }

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId)
    setCurrentView('chat')
    setIsSidebarOpen(false)
  }

  if (!token || !user) {
    return <AuthPage onAuth={handleAuth} />
  }

  return (
    <div className="app-container">
      <Sidebar
        onNavigate={setCurrentView}
        currentView={currentView}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        token={token}
        user={user}
        onLogout={handleLogout}
        onNewChat={handleNewChat}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        refreshKey={sidebarRefreshKey}
      />

      <main className="main-content">
        <div className="top-bar">
          <button className="menu-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {currentView === 'chat' && (
          <ChatArea
            token={token}
            activeChatId={activeChatId}
            onChatCreated={handleChatCreated}
          />
        )}
        {currentView === 'settings' && <Settings theme={theme} setTheme={setTheme} />}
        {currentView === 'profile' && <Profile user={user} />}
      </main>
    </div>
  )
}

export default App
