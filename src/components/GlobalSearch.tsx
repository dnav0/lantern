import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NoteSearchResult } from '../types'
import { parseScriptureQuery, parseNoteLine } from '../utils/noteParser'
import { formatRelativeTime } from '../utils/relativeTime'
import { useApi } from '../api/context'

export interface SearchJumpTargets {
  // Jump into the Bible view at a book/chapter (verse is advisory context only
  // for v1 — the chapter reader has no verse-scroll hook yet).
  onJumpToChapter: (bookName: string, chapter: number, verse: number | null) => void
  // Open the full study containing a matched note.
  onOpenStudy: (passageId: string) => void
}

interface GlobalSearchProps extends SearchJumpTargets {
  // 'bar' = the always-present desktop top-bar input.
  // 'surface' = the dedicated mobile search page (full-width, own results panel).
  variant: 'bar' | 'surface'
  // Called after any result is chosen, so the host can close the popover/surface.
  onClose?: () => void
  autoFocus?: boolean
}

const DEBOUNCE_MS = 120

// First-line preview of a note with tag tokens stripped, for the result row.
function notePreview(content: string): string {
  const firstLine = content.split('\n')[0]
  const { segments } = parseNoteLine(firstLine)
  return segments
    .filter(s => s.type !== 'tag')
    .map(s => (s.type === 'text' ? s.raw : s.display))
    .join('')
    .trim()
}

/**
 * One search box, two independently-populating result sections:
 *   (1) scripture-reference matches — pure client-side parse of the query
 *       (parseScriptureQuery); click jumps into the Bible view.
 *   (2) matching notes — BereanApi.searchNotes over note content; click opens
 *       the study in context.
 *
 * The two sections are decoupled by design: (1) is derived synchronously from
 * the query via useMemo, (2) resolves asynchronously and lands whenever it's
 * ready. Neither blocks the other, so a future staggered "populate" animation
 * can key off each section mounting on its own.
 */
export default function GlobalSearch({
  variant,
  onJumpToChapter,
  onOpenStudy,
  onClose,
  autoFocus
}: GlobalSearchProps): React.ReactElement {
  const api = useApi()
  const [query, setQuery] = useState('')
  const [noteResults, setNoteResults] = useState<NoteSearchResult[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Section 1: scripture reference(s) — synchronous, from the query alone.
  // May be zero, one, or (for an ambiguous book prefix) up to a handful of
  // ranked results; see parseScriptureQuery for the ordering/cap rule.
  const scriptureResults = useMemo(() => parseScriptureQuery(query), [query])

  // Section 2: notes — async, debounced; lands independently of section 1.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setNoteResults([])
      setNotesLoading(false)
      return
    }
    setNotesLoading(true)
    let cancelled = false
    const handle = window.setTimeout(() => {
      api
        .searchNotes(q)
        .then(rows => {
          if (!cancelled) setNoteResults(rows)
        })
        .catch(() => {
          if (!cancelled) setNoteResults([])
        })
        .finally(() => {
          if (!cancelled) setNotesLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [api, query])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const choose = useCallback(
    (fn: () => void) => {
      fn()
      setQuery('')
      setNoteResults([])
      onClose?.()
    },
    [onClose]
  )

  const hasQuery = query.trim().length > 0
  const showResults = hasQuery
  const nothing = hasQuery && scriptureResults.length === 0 && !notesLoading && noteResults.length === 0

  const results = (
    <div className="search-results" role="listbox" aria-label="Search results">
      {/* Section 1 — scripture reference(s); may be zero, one, or several
          (ambiguous book prefix) ranked results. */}
      {scriptureResults.length > 0 && (
        <div className="search-section" data-section="scripture">
          <div className="search-section-label">Jump to scripture</div>
          {scriptureResults.map(scripture => {
            const ref =
              scripture.verse != null
                ? `${scripture.bookName} ${scripture.chapter}:${scripture.verse}`
                : scripture.kind === 'book'
                  ? scripture.bookName
                  : `${scripture.bookName} ${scripture.chapter}`
            const kindLabel = scripture.kind === 'book' ? 'Open book' : 'Open chapter'
            return (
              <button
                key={`${scripture.bookNumber}-${scripture.chapter}-${scripture.verse ?? ''}`}
                className="search-result search-result--scripture"
                role="option"
                aria-selected={false}
                onClick={() =>
                  choose(() => onJumpToChapter(scripture.bookName, scripture.chapter, scripture.verse))
                }
              >
                <span className="search-result-ref">{ref}</span>
                <span className="search-result-kind">{kindLabel}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Section 2 — matching notes */}
      {(notesLoading || noteResults.length > 0) && (
        <div className="search-section" data-section="notes">
          <div className="search-section-label">
            Notes{!notesLoading && noteResults.length > 0 ? ` · ${noteResults.length}` : ''}
          </div>
          {notesLoading && noteResults.length === 0 ? (
            <div className="search-note-loading">Searching notes…</div>
          ) : (
            noteResults.map(r => {
              const preview = notePreview(r.note.content)
              return (
                <button
                  key={r.note.id}
                  className="search-result search-result--note"
                  role="option"
                  aria-selected={false}
                  onClick={() => choose(() => onOpenStudy(r.passage_id))}
                >
                  <div className="search-result-note-top">
                    <span className="search-result-ref">{r.reference_label}</span>
                    <span className="search-result-time note-timestamp">
                      {formatRelativeTime(r.note.updated_at ?? r.note.created_at)}
                    </span>
                  </div>
                  <div className="search-result-note-preview">{preview || '(empty note)'}</div>
                </button>
              )
            })
          )}
        </div>
      )}

      {nothing && <div className="search-empty">No scripture reference or notes match “{query.trim()}”.</div>}
    </div>
  )

  return (
    <div className={`global-search global-search--${variant}`}>
      <div className="search-input-wrap">
        <svg
          className="search-input-icon"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              if (query) setQuery('')
              else onClose?.()
            }
          }}
          placeholder="Search references or notes…"
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="search"
          aria-label="Search references or notes"
        />
      </div>
      {showResults && results}
    </div>
  )
}
