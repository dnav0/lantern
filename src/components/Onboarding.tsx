import React, { useState } from 'react'
import Wordmark from './Wordmark'
import { updateDisplayName, markOnboardingDone } from '../api/auth'

interface OnboardingProps {
  // Called when the flow finishes; App re-reads the profile and enters the app.
  onDone: () => void
}

// First-run flow after the first sign-in: one skippable screen for an optional
// name. The explainer screens this used to show (study mode, reading mode) were
// removed — point-of-use hints now teach those mechanics in context instead of
// front-loading them here. Copy is plain and quiet — no exclamation marks, no
// marketing.
export default function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
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

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <Wordmark size={30} style={{ display: 'block' }} />

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
              if (e.key === 'Enter') finish()
            }}
          />
          <button className="welcome-btn-primary" onClick={finish} disabled={saving}>
            {saving ? 'Getting things ready…' : 'Start reading'}
          </button>
        </div>

        <button className="onboarding-skip" onClick={finish} disabled={saving}>
          Skip
        </button>
      </div>
    </div>
  )
}
