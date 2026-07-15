import React, { useEffect, useState } from 'react'
import { sendOtp, verifyOtp } from '../api/auth'

// The sign-in dialog, per design/lantern-mockup.html's login direction: a card
// over a scrim, opened from the landing page's CTAs rather than being the whole
// signed-out screen (it used to be — see Root.tsx).
//
// Email OTP, two steps: enter email -> a code is emailed -> enter the code. On
// success, Root's onAuthStateChange takes over and mounts the app; this dialog
// never sees the signed-in state.
//
// Google sign-in belongs above the email divider (it is the prominent one-click
// default in the spec). It is not wired yet — see BACKLOG: the code path is a
// separate pass, and it needs OAuth credentials registered in Supabase first.

interface SignInProps {
  onClose: () => void
}

export default function SignIn({ onClose }: SignInProps): React.JSX.Element {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape closes, matching every other dismissible surface in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
    <div
      className="ll-scrim"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ll-card" role="dialog" aria-modal="true" aria-label="Sign in">
        <button className="ll-x" type="button" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {/* The spec put the (now retired) pictorial mark above this heading. With
            a wordmark-only identity that would render "Lantern" twice, stacked —
            so the serif heading is the brand anchor here. */}
        {step === 'email' ? (
          <>
            <h2 className="ll-h serif">Welcome to Lantern</h2>
            <p className="ll-sub">
              Sign in to keep your studies. New here? This creates your account.
            </p>
            <form className="ll-form" onSubmit={handleSendCode}>
              <input
                className="ll-field"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={busy}
              />
              {error && <p className="ll-error">{error}</p>}
              <button
                className="ll-btn ll-btn-primary ll-btn-full"
                type="submit"
                disabled={busy || !email.trim()}
              >
                {busy ? 'Sending…' : 'Send me a sign-in code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="ll-h serif">Check your email</h2>
            <p className="ll-sub">
              We sent a message to {email.trim()}. Open the sign-in link on this device, or enter
              the 6-digit code if the email includes one.
            </p>
            <form className="ll-form" onSubmit={handleVerify}>
              <input
                className="ll-field ll-field--code"
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
              {error && <p className="ll-error">{error}</p>}
              <button
                className="ll-btn ll-btn-primary ll-btn-full"
                type="submit"
                disabled={busy || code.length < 6}
              >
                {busy ? 'Verifying…' : 'Verify'}
              </button>
              <button
                className="ll-btn ll-btn-ghost ll-btn-full"
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
          </>
        )}
      </div>
    </div>
  )
}
