import React, { useEffect, useState } from 'react'
import { sendOtp, signInWithGoogle, verifyOtp } from '../api/auth'
import GoogleMark from './landing/GoogleMark'

// The sign-in dialog, per design/lantern-mockup.html's login direction: a card
// over a scrim, opened from the landing page's CTAs rather than being the whole
// signed-out screen (it used to be — see Root.tsx).
//
// Google is the prominent one-click default; email OTP sits below the divider as
// the fallback. Both reach the same account (see api/auth.ts on identity
// linking). Email OTP is two steps: enter email -> a code is emailed -> enter the
// code. On success, Root's onAuthStateChange takes over and mounts the app; this
// dialog never sees the signed-in state.
//
// `emailFirst` hides the Google button: the landing's "Continue with email"
// already expressed a choice, so re-offering Google on top of the email field
// would be asking the same question twice.

interface SignInProps {
  onClose: () => void
  /** Open directly on the email step rather than showing Google first. */
  emailFirst?: boolean
}

export default function SignIn({ onClose, emailFirst = false }: SignInProps): React.JSX.Element {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogle = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      // On success the browser leaves for Google, so this never resolves here.
      await signInWithGoogle()
    } catch {
      setError('Could not reach Google. Try again, or continue with email.')
      setBusy(false)
    }
  }

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

            {!emailFirst && (
              <>
                <button
                  className="ll-google-btn"
                  type="button"
                  onClick={handleGoogle}
                  disabled={busy}
                >
                  <GoogleMark />
                  Continue with Google
                </button>
                <div className="ll-divider">or continue with email</div>
              </>
            )}

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
            {/* Standalone pages served by Cloudflare Pages (public/terms.html,
                public/privacy.html), so plain anchors, opened in a new tab to
                keep the sign-in flow intact. */}
            <p className="ll-legal">
              By continuing you agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              .
            </p>
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
