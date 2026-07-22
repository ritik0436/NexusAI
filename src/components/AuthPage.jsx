import { useState, useRef, useEffect } from 'react'
import './AuthPage.css'
import API_URL from '../config'

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'verify'
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [pendingEmail, setPendingEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const otpRefs = useRef([])

  useEffect(() => {
    if (mode === 'verify') otpRefs.current[0]?.focus()
  }, [mode])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    setError('')
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    try {
      if (mode === 'login') {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password })
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.needsVerification) {
            setPendingEmail(data.email)
            setMode('verify')
            setInfo('Your account needs verification. A new code was sent to your email.')
          } else {
            setError(data.error || 'Something went wrong')
          }
        } else {
          localStorage.setItem('nexus_token', data.token)
          localStorage.setItem('nexus_user', JSON.stringify(data.user))
          onAuth(data.token, data.user)
        }
      } else if (mode === 'register') {
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username, email: form.email, password: form.password })
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Something went wrong')
        } else {
          setPendingEmail(form.email)
          setMode('verify')
          setInfo(data.message || 'Check your email for the verification code.')
        }
      }
    } catch {
      setError('Cannot connect to server. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) return setError('Enter the full 6-digit code')
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Verification failed')
        setOtp(['', '', '', '', '', ''])
        otpRefs.current[0]?.focus()
      } else {
        localStorage.setItem('nexus_token', data.token)
        localStorage.setItem('nexus_user', JSON.stringify(data.user))
        onAuth(data.token, data.user)
      }
    } catch {
      setError('Cannot connect to server.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/auth/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail })
      })
      const data = await res.json()
      if (!res.ok) setError(data.error)
      else { setInfo('New code sent! Check your email.'); setOtp(['', '', '', '', '', '']); otpRefs.current[0]?.focus() }
    } catch {
      setError('Cannot connect to server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-orb orb-a"></div>
        <div className="auth-orb orb-b"></div>
        <div className="auth-orb orb-c"></div>
      </div>

      <div className="auth-card animate-slide-up">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <path d="M24 4V44M4 24H44" stroke="url(#authGrad)" strokeWidth="6" strokeLinecap="round"/>
              <defs>
                <linearGradient id="authGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="auth-brand">Nexus AI</h1>
        </div>

        {/* ── VERIFY SCREEN ── */}
        {mode === 'verify' ? (
          <>
            <div className="verify-icon">📬</div>
            <h2 className="auth-title">Check your email</h2>
            <p className="auth-subtitle">
              We sent a 6-digit code to<br />
              <strong>{pendingEmail}</strong>
            </p>

            {info && <div className="auth-info">{info}</div>}
            {error && <div className="auth-error">{error}</div>}

            <form className="auth-form" onSubmit={handleVerify}>
              <div className="otp-row" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`otp-box ${digit ? 'filled' : ''}`}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    autoComplete="off"
                  />
                ))}
              </div>

              <button type="submit" className="auth-submit" disabled={loading || otp.join('').length < 6}>
                {loading ? <span className="auth-spinner"></span> : 'Verify Email'}
              </button>
            </form>

            <p className="auth-switch">
              Didn't receive it?{' '}
              <button type="button" className="auth-switch-btn" onClick={handleResend} disabled={loading}>
                Resend code
              </button>
            </p>
            <p className="auth-switch">
              <button type="button" className="auth-switch-btn" onClick={() => { setMode('login'); setError(''); setInfo('') }}>
                ← Back to sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="auth-title">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="auth-subtitle">
              {mode === 'login' ? 'Sign in to continue your conversations' : 'Start chatting with Nexus AI for free'}
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <div className="auth-field">
                  <label htmlFor="username">Username</label>
                  <input id="username" name="username" type="text" placeholder="Your name"
                    value={form.username} onChange={handleChange} required autoComplete="name" />
                </div>
              )}
              <div className="auth-field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" placeholder="you@example.com"
                  value={form.email} onChange={handleChange} required autoComplete="email" />
              </div>
              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password"
                  placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'}
                  value={form.password} onChange={handleChange} required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? <span className="auth-spinner"></span> : (mode === 'login' ? 'Sign in' : 'Create account')}
              </button>
            </form>

            <p className="auth-switch">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" className="auth-switch-btn"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
