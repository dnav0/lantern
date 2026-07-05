import React, { useCallback, useState } from 'react'
import { useApi } from '../api/context'
import { exportAllNotesAsZip } from '../platform/export'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  isDark: boolean
  onToggleDark: () => void
  // Sign-out handler, or null when there is no auth (memory stub / dev).
  onSignOut: (() => Promise<void>) | null
}

// Translation and vault settings were removed with the Electron layer.
export default function SettingsModal({
  isOpen,
  onClose,
  isDark,
  onToggleDark,
  onSignOut
}: SettingsModalProps): React.ReactElement | null {
  const api = useApi()
  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'error'>('idle')

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  const handleExport = useCallback(async () => {
    setExportState('exporting')
    try {
      await exportAllNotesAsZip(api)
      setExportState('idle')
    } catch (err) {
      console.error('[export] failed:', err)
      setExportState('error')
    }
  }, [api])

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

          {/* Export */}
          <div className="smodal-section">
            <div className="smodal-section-label">Export</div>
            <p className="smodal-vault-desc">
              Download all your notes as a zip of Markdown files, one per passage.
            </p>
            <div className="smodal-vault-actions">
              <button
                className="smodal-vault-btn"
                onClick={() => void handleExport()}
                disabled={exportState === 'exporting'}
              >
                {exportState === 'exporting' ? 'Exporting…' : 'Export all notes'}
              </button>
            </div>
            {exportState === 'error' && (
              <p className="smodal-vault-desc" style={{ color: '#C0392B' }}>
                Export failed. Check your connection and try again.
              </p>
            )}
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
