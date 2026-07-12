import React, { useState, useEffect } from 'react'
import { JournalEntry } from '../types'
import { bookByNumber } from '../utils/bibleBooks'
import { parseNoteLine } from '../utils/noteParser'
import { useApi } from '../api/context'

interface JournalPageProps {
  // Open a study (StudyMode) for the given passage.
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

// Below this, don't bother showing a skeleton at all — for a fetch this
// fast, the skeleton appearing (then almost immediately being replaced)
// reads as more of a flash/flicker than the blank instant it's meant to
// smooth over. Standard "avoid a flash of loading state" delay: only start
// showing the placeholder once a fetch has genuinely taken a while.
const SKELETON_DELAY_MS = 150

export default function JournalPage({ onOpenStudy }: JournalPageProps): React.ReactElement {
  const api = useApi()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showSkeleton, setShowSkeleton] = useState(false)

  useEffect(() => {
    let settled = false
    const skeletonTimer = window.setTimeout(() => {
      if (!settled) setShowSkeleton(true)
    }, SKELETON_DELAY_MS)
    api.getJournalEntries().then(es => {
      settled = true
      window.clearTimeout(skeletonTimer)
      setEntries(es)
      setLoading(false)
    })
    return () => {
      settled = true
      window.clearTimeout(skeletonTimer)
    }
  }, [api])

  if (loading) {
    // Nothing rendered yet for the first SKELETON_DELAY_MS — a brief blank
    // beat is far less jarring than a placeholder that pops in only to be
    // replaced a moment later. `.journal-index` mounting fresh (whichever
    // content ends up in it — skeleton or, on a fast load, the real list
    // directly) is what gets the entrance fade in motion.css; it plays
    // exactly once per visit either way.
    if (!showSkeleton) return <div className="journal-page" />
    return (
      <div className="journal-page">
        <div className="journal-index">
          {/* Real heading (title never changes, unlike the count below it) so
              the loading → loaded transition doesn't shift the whole list
              down by a heading's height once data lands — that reflow was
              exactly the "flash" bug: cards started at the very top, then
              the page jumped once "Journal" and its count line appeared. */}
          <div className="journal-header">
            <h1 className="journal-heading">Journal</h1>
            <span className="skeleton-line journal-sub-skeleton" aria-hidden="true" />
          </div>
          <div className="journal-body">
            <div className="journal-skeleton" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="journal-entry-skeleton" key={i}>
                  <div className="journal-entry-skeleton-top">
                    <span className="skeleton-line" style={{ width: '38%', height: 14 }} />
                    <span className="skeleton-line" style={{ width: 56, height: 10 }} />
                  </div>
                  <span className="skeleton-line" style={{ width: '70%', height: 10, marginTop: 8 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
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
        <div className="journal-header">
          <h1 className="journal-heading">Journal</h1>
          <div className="journal-sub">
            {entries.length} stud{entries.length === 1 ? 'y' : 'ies'} across {groups.length} book
            {groups.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="journal-body">
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
    </div>
  )
}
