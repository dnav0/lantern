import React, { useState, useEffect } from 'react'
import { JournalEntry } from '../types'
import { bookByNumber } from '../utils/bibleBooks'
import { parseNoteLine } from '../utils/noteParser'
import { useApi } from '../api/context'

interface JournalPageProps {
  // Open a study (SessionEditor) for the given passage.
  onOpenStudy: (passageId: string) => void
}

// First-line preview of a note, with tag tokens (@obs etc.) stripped.
function previewText(content: string): string {
  const firstLine = content.split('\n')[0]
  const { segments } = parseNoteLine(firstLine)
  return segments
    .filter(s => s.type !== 'tag')
    .map(s => (s.type === 'text' ? s.raw : s.display))
    .join('')
    .trim()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

interface BookGroup {
  bookNumber: number
  bookName: string
  entries: JournalEntry[]
}

// Group entries by book (canonical order); newest study first within a group.
function groupByBook(entries: JournalEntry[]): BookGroup[] {
  const groups = new Map<number, JournalEntry[]>()
  for (const e of entries) {
    const key = e.passage.book_number
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bookNumber, es]) => ({
      bookNumber,
      bookName: bookByNumber(bookNumber)?.name ?? `Book ${bookNumber}`,
      entries: es.sort((a, b) => {
        const aDate = a.last_note_at ?? a.passage.created_at
        const bDate = b.last_note_at ?? b.passage.created_at
        return bDate.localeCompare(aDate)
      })
    }))
}

export default function JournalPage({ onOpenStudy }: JournalPageProps): React.ReactElement {
  const api = useApi()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getJournalEntries().then(es => {
      setEntries(es)
      setLoading(false)
    })
  }, [api])

  if (loading) {
    return (
      <div className="journal-page">
        <div className="loading-dots">Loading…</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="journal-page">
        <div className="journal-page-empty">
          <div className="journal-page-title">Journal</div>
          <p className="journal-page-hint">
            No studies yet. Start one from the Bible view or the + Study tab — it will show up
            here, grouped by book.
          </p>
        </div>
      </div>
    )
  }

  const groups = groupByBook(entries)

  return (
    <div className="journal-page">
      <div className="journal-index">
        <h1 className="journal-heading">Journal</h1>
        <div className="journal-sub">
          {entries.length} stud{entries.length === 1 ? 'y' : 'ies'} across {groups.length} book
          {groups.length === 1 ? '' : 's'}
        </div>

        {groups.map(group => (
          <div key={group.bookNumber} className="journal-book-group">
            <div className="journal-book-header">{group.bookName}</div>
            {group.entries.map(entry => {
              const date = entry.last_note_at ?? entry.passage.created_at
              const preview = entry.preview ? previewText(entry.preview) : ''
              return (
                <button
                  key={entry.passage.id}
                  className="journal-entry"
                  onClick={() => onOpenStudy(entry.passage.id)}
                >
                  <div className="journal-entry-top">
                    <span className="journal-entry-ref">{entry.passage.reference_label}</span>
                    <span className="journal-entry-date">{formatDate(date)}</span>
                  </div>
                  <div className="journal-entry-bottom">
                    <span className="journal-entry-count">
                      {entry.note_count} note{entry.note_count === 1 ? '' : 's'}
                    </span>
                    {preview && <span className="journal-entry-preview">{preview}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
