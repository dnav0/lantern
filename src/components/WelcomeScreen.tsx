import React from 'react'
import AppLogo from './AppLogo'

interface WelcomeScreenProps {
  onReady: () => void
}

// Phase 0 placeholder. Phase 1 replaces this with auth (email OTP) + onboarding
// (optional name prompt, short intro to capture/reading modes).
export default function WelcomeScreen({ onReady }: WelcomeScreenProps): React.ReactElement {
  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <AppLogo size={56} style={{ borderRadius: 13 }} />

        <h1 className="welcome-title">Welcome to Berean</h1>
        <p className="welcome-subtitle">Personal Bible study notes</p>

        <p className="welcome-body">
          A quiet place to capture what you see in Scripture and read it back later.
        </p>

        <div className="welcome-actions">
          <button className="welcome-btn-primary" onClick={onReady}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
