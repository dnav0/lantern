import React, { useState } from 'react'
import AppLogo from './AppLogo'
import { updateDisplayName, markOnboardingDone } from '../api/auth'

interface OnboardingProps {
  // Called when the flow finishes; App re-reads the profile and enters the app.
  onDone: () => void
}

// First-run flow after the first sign-in: an optional name step, then two short
// screens introducing capture and reading modes. Skippable at every step. Copy is
// plain and quiet — no exclamation marks, no marketing.
export default function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const finish = async (): Promise<void> => {
    setSaving(true)
    try {
      const trimmed = name.trim()
      if (trimmed) {
        try {
          await updateDisplayName(trimmed)
        } catch {
          // Name is optional; a failure here should not block onboarding.
        }
      }
      await markOnboardingDone()
    } catch {
      // Even if marking fails, let the user in — the gate falls back to
      // localStorage so they will not be stuck on this screen.
      localStorage.setItem('berean.onboarded', '1')
    } finally {
      setSaving(false)
      onDone()
    }
  }

  const next = (): void => setStep(s => s + 1)

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <AppLogo size={56} style={{ borderRadius: 13 }} />

        {step === 0 && (
          <>
            <h1 className="welcome-title">What should we call you?</h1>
            <p className="welcome-body">Optional. Used to greet you when you open the app.</p>
            <div className="auth-form">
              <input
                className="auth-input"
                type="text"
                autoFocus
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') next()
                }}
              />
              <button className="welcome-btn-primary" onClick={next}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="welcome-title">Capture mode</h1>
            <p className="welcome-body">
              Type a reference, read the passage, and write what you see —
              observations, historical context, application, personal reflection.
              Notes anchor to the verses they belong to.
            </p>
            <div className="welcome-actions">
              <button className="welcome-btn-primary" onClick={next}>
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="welcome-title">Reading mode</h1>
            <p className="welcome-body">
              Come back to any passage to read your notes against the text,
              browse the whole Bible by book, and pick up where you left off.
            </p>
            <div className="welcome-actions">
              <button className="welcome-btn-primary" onClick={finish} disabled={saving}>
                {saving ? 'Getting things ready…' : 'Start reading'}
              </button>
            </div>
          </>
        )}

        {step < 2 && (
          <button className="onboarding-skip" onClick={finish} disabled={saving}>
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
