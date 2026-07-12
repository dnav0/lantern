import React, { useCallback, useState } from 'react'
import { useApi } from '../api/context'
import { exportAllNotesAsZip } from '../platform/export'
import { THEMES, type ThemeId } from '../utils/useTheme'
import { TEXT_SIZES, type TextSizeId } from '../utils/useTextSize'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  isDark: boolean
  onToggleDark: () => void
  theme: ThemeId
  onSetTheme: (theme: ThemeId) => void
  textSize: TextSizeId
  onSetTextSize: (size: TextSizeId) => void
  // Sign-out handler, or null when there is no auth (memory stub / dev).
  onSignOut: (() => Promise<void>) | null
}

// Translation and vault settings were removed with the Electron layer.
export default function SettingsModal({
  isOpen,
  onClose,
  isDark,
  onToggleDark,
  theme,
  onSetTheme,
  textSize,
  onSetTextSize,
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

          {/* Theme — the color/reading-type direction, independent of light/dark */}
          <div className="smodal-section">
            <div className="smodal-section-label">Theme</div>
            <div className="theme-picker" role="radiogroup" aria-label="Visual theme">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-swatch${theme === t.id ? ' active' : ''}`}
                  onClick={() => onSetTheme(t.id)}
                  role="radio"
                  aria-checked={theme === t.id}
                >
                  <span className={`theme-swatch-preview theme-preview-${t.id}`} aria-hidden="true">
                    <span className="theme-preview-accent" />
                  </span>
                  <span className="theme-swatch-text">
                    <span className="theme-swatch-label">{t.label}</span>
                    <span className="theme-swatch-blurb">{t.blurb}</span>
                  </span>
                  {theme === t.id && (
                    <svg className="theme-swatch-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="smodal-divider" />

          {/* Text size — scripture reading type only, independent of theme.
              A segmented row rather than the theme swatch treatment: there's
              nothing to preview beyond the label itself. */}
          <div className="smodal-section">
            <div className="smodal-section-label">Scripture text size</div>
            <div className="text-size-picker" role="radiogroup" aria-label="Scripture text size">
              {TEXT_SIZES.map(s => (
                <button
                  key={s.id}
                  className={`text-size-option${textSize === s.id ? ' active' : ''}`}
                  onClick={() => onSetTextSize(s.id)}
                  role="radio"
                  aria-checked={textSize === s.id}
                >
                  {s.label}
                </button>
              ))}
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
