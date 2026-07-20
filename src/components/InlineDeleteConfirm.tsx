import React from 'react'

interface InlineDeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

// Replaces the old full-screen ConfirmDialog for note deletion — reuses
// QuickEditCard's card/footer/button chrome (same classNames) so a delete
// prompt reads as "part of the same system" as the quick-edit card it
// appears in place of, rather than a different, heavier UI pattern
// (backdrop + centered modal) for what's a single low-stakes confirmation.
export default function InlineDeleteConfirm({
  onConfirm,
  onCancel
}: InlineDeleteConfirmProps): React.ReactElement {
  return (
    <div className="quick-edit-card quick-edit-card--danger">
      <div className="quick-edit-body quick-edit-confirm-message">
        Delete this note? This can't be undone.
      </div>
      <div className="quick-edit-footer quick-edit-footer--confirm">
        <div className="quick-edit-actions">
          <button type="button" className="quick-edit-btn quick-edit-btn-cancel" onClick={onCancel}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Cancel
          </button>
          <button
            type="button"
            className="quick-edit-btn quick-edit-btn-danger"
            onClick={onConfirm}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
