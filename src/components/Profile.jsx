import './Profile.css'

export default function Profile() {
  return (
    <div className="view-container animate-fade-in">
      <div className="view-header">
        <h2>Your Profile</h2>
        <p>Manage your account details and view statistics.</p>
      </div>

      <div className="profile-content">
        <div className="profile-card glass-panel">
          <div className="profile-header-large">
            <div className="avatar-large">U</div>
            <div className="profile-info-large">
              <h3>User Account</h3>
              <span className="badge pro-badge">Pro Plan</span>
            </div>
          </div>
          
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-value">1,204</div>
              <div className="stat-label">Messages Sent</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">14</div>
              <div className="stat-label">Active Days</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">3</div>
              <div className="stat-label">Models Used</div>
            </div>
          </div>

          <div className="profile-actions">
            <button className="primary-btn">Upgrade Plan</button>
            <button className="secondary-btn">Sign Out</button>
          </div>
        </div>
      </div>
    </div>
  )
}
