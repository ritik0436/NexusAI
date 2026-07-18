import './Settings.css'
import { useState } from 'react'

export default function Settings() {
  const [model, setModel] = useState('nexus-fast')
  const [theme, setTheme] = useState('dark')

  return (
    <div className="view-container animate-fade-in">
      <div className="view-header">
        <h2>Settings</h2>
        <p>Customize your chatbot experience and preferences.</p>
      </div>

      <div className="settings-content">
        <div className="settings-group glass-panel">
          <h3 className="settings-group-title">Chat Preferences</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <h4>AI Model</h4>
              <p>Select the model architecture for generation.</p>
            </div>
            <select className="setting-select" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="nexus-fast">Nexus Fast (Optimized for speed)</option>
              <option value="nexus-pro">Nexus Pro (Highest reasoning)</option>
              <option value="nexus-creative">Nexus Creative (Storytelling)</option>
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4>System Prompt</h4>
              <p>Custom instructions for the AI's behavior.</p>
            </div>
            <button className="secondary-btn">Edit Prompt</button>
          </div>
        </div>

        <div className="settings-group glass-panel">
          <h3 className="settings-group-title">Appearance</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <h4>Theme</h4>
              <p>Choose your preferred interface theme.</p>
            </div>
            <div className="theme-toggle">
              <button 
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
              <button 
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
            </div>
          </div>
        </div>

        <div className="settings-group glass-panel danger-zone">
          <h3 className="settings-group-title text-danger">Danger Zone</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <h4>Clear Chat History</h4>
              <p>Permanently delete all your conversations.</p>
            </div>
            <button className="danger-btn">Clear History</button>
          </div>
        </div>
      </div>
    </div>
  )
}
