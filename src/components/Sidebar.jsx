import './Sidebar.css'

export default function Sidebar({ onNavigate, currentView }) {
  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-dot"></div>
          <h2>Nexus AI</h2>
        </div>
        <button 
          className={`new-chat-btn ${currentView === 'chat' ? 'active-btn' : ''}`}
          onClick={() => onNavigate('chat')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          New Chat
        </button>
      </div>

      <div className="sidebar-content">
        <div className="history-group">
          <h3 className="history-title">Today</h3>
          <ul className="history-list">
            <li className="history-item active" onClick={() => onNavigate('chat')}>React Frontend Setup</li>
            <li className="history-item" onClick={() => onNavigate('chat')}>Design System Planning</li>
          </ul>
        </div>
        <div className="history-group">
          <h3 className="history-title">Previous 7 Days</h3>
          <ul className="history-list">
            <li className="history-item" onClick={() => onNavigate('chat')}>Vite Configuration</li>
            <li className="history-item" onClick={() => onNavigate('chat')}>API Architecture</li>
          </ul>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="footer-actions">
          <div 
            className={`user-profile ${currentView === 'profile' ? 'active-nav' : ''}`} 
            onClick={() => onNavigate('profile')}
          >
            <div className="avatar">U</div>
            <div className="user-info">
              <span className="user-name">User</span>
              <span className="user-status">Pro Plan</span>
            </div>
          </div>
          
          <button 
            className={`settings-btn ${currentView === 'settings' ? 'active-icon' : ''}`}
            onClick={() => onNavigate('settings')}
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.4 15A1.65 1.65 0 0 0 19.28 12.87L21 11.14C21.36 10.78 21.36 10.19 21 9.83L19.59 8.42C19.23 8.06 18.64 8.06 18.28 8.42L16.55 10.14A1.65 1.65 0 0 0 14.42 10.26L14.28 7.82C14.23 7.31 13.8 6.92 13.29 6.92H10.71C10.2 6.92 9.77 7.31 9.72 7.82L9.58 10.26A1.65 1.65 0 0 0 7.45 10.14L5.72 8.42C5.36 8.06 4.77 8.06 4.41 8.42L3 9.83C2.64 10.19 2.64 10.78 3 11.14L4.72 12.87A1.65 1.65 0 0 0 4.6 15L2.16 15.14C1.65 15.19 1.26 15.62 1.26 16.13V18.71C1.26 19.22 1.65 19.65 2.16 19.7L4.6 19.84A1.65 1.65 0 0 0 6.73 19.96L8.46 21.68C8.82 22.04 9.41 22.04 9.77 21.68L11.18 20.27C11.54 19.91 12.13 19.91 12.49 20.27L14.22 21.68C14.58 22.04 15.17 22.04 15.53 21.68L16.94 20.27C17.3 19.91 17.3 19.32 16.94 18.96L15.22 17.23A1.65 1.65 0 0 0 15.34 15.1L17.78 14.96C18.29 14.91 18.72 14.48 18.72 13.97V11.39C18.72 10.88 18.33 10.45 17.82 10.4L15.38 10.26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
