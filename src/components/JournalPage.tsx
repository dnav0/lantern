import React from 'react'

/**
 * Journal destination — placeholder. Workstream 2 replaces this with the
 * browseable index of study sessions (grouped by book, newest first).
 */
export default function JournalPage(): React.ReactElement {
  return (
    <div className="journal-page">
      <div className="journal-page-empty">
        <div className="journal-page-title">Journal</div>
        <p className="journal-page-hint">
          Your study sessions will be browseable here soon — grouped by book, newest first.
        </p>
      </div>
    </div>
  )
}
