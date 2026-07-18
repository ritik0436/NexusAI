import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import Settings from './components/Settings'
import Profile from './components/Profile'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('chat')

  return (
    <div className="app-container">
      <Sidebar onNavigate={setCurrentView} currentView={currentView} />
      <main className="main-content">
        {currentView === 'chat' && <ChatArea />}
        {currentView === 'settings' && <Settings />}
        {currentView === 'profile' && <Profile />}
      </main>
    </div>
  )
}

export default App
