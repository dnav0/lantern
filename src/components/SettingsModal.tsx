import React, { useCallback } from 'react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  isDark: boolean
  onToggleDark: () => void
  // Sign-out handler, or null when there is no auth (memory stub / dev).
  onSignOut: (() => Promise<void>) | null
}

// Translation and vault settings were removed with the Electron layer.
// Placeholders below mark where dark-mode lives now and where "Export all notes"
// (Phase 4, via platform/export.ts) will go.
export default function SettingsModal({
  isOpen,
  onClose,
  isDark,
  onToggleDark,
  onSignOut
}: SettingsModalProps): React.ReactElement | null {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <div className="smodal-backdrop" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="smodal-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="smodal-header">
          <span className="smodal-title">Settings</span>
          <button className="smodal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="smodal-body">
          {/* Appearance */}
          <div className="smodal-section">
            <div className="smodal-section-label">Appearance</div>
            <div className="smodal-vault-actions">
              <button className="smodal-vault-btn" onClick={onToggleDark}>
                {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              </button>
            </div>
          </div>

          <div className="smodal-divider" />

          {/* Export (placeholder) */}
          <div className="smodal-section">
            <div className="smodal-section-label">Export</div>
            <p className="smodal-vault-desc">
              Export all notes as Markdown. Coming in a later release.
            </p>
            <div className="smodal-vault-actions">
              <button className="smodal-vault-btn" disabled>
                Export all notes
              </button>
            </div>
          </div>

          <div className="smodal-divider" />

          {/* Account */}
          {onSignOut && (
            <div className="smodal-section">
              <div className="smodal-section-label">Account</div>
              <div className="smodal-vault-actions">
                <button className="smodal-vault-btn" onClick={() => void onSignOut()}>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="smodal-footer">
          <button className="smodal-btn-save" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
