import React, { useState } from 'react'
import AppLogo from './AppLogo'
import { sendOtp, verifyOtp } from '../api/auth'

// Email OTP sign-in. Two steps: enter email -> a 6-digit code is emailed ->
// enter the code. On success the parent re-checks the session and mounts the app.
export default function SignIn(): React.ReactElement {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await sendOtp(trimmed)
      setStep('code')
    } catch {
      setError('Could not send the code. Check the address and try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length < 6) return
    setBusy(true)
    setError(null)
    try {
      await verifyOtp(email.trim(), trimmed)
      // onAuthStateChange in the bootstrap takes it from here.
    } catch {
      setError('That code did not match. Check it and try again.')
      setBusy(false)
    }
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <AppLogo size={56} style={{ borderRadius: 13 }} />
        <h1 className="welcome-title">Berean</h1>
        <p className="welcome-subtitle">Personal Bible study notes</p>

        {step === 'email' ? (
          <form className="auth-form" onSubmit={handleSendCode}>
            <p className="welcome-body">
              Sign in with your email. We will send a one-time code.
            </p>
            <input
              className="auth-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="welcome-btn-primary" type="submit" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleVerify}>
            <p className="welcome-body">
              Check your email at {email.trim()} — open the sign-in link on this device,
              or enter the 6-digit code if the email includes one.
            </p>
            <input
              className="auth-input auth-input--code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={busy}
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="welcome-btn-primary" type="submit" disabled={busy || code.length < 6}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              className="welcome-btn-secondary"
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
              disabled={busy}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
