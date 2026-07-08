import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import NoteEditor, { makeLineId } from './NoteEditor'
import PassagePane from './PassagePane'
import ReferenceInput from './ReferenceInput'
import { BiblePassage, Note } from '../types'
import { parseNoteLine, parseReferenceLabel } from '../utils/noteParser'
import { findBookByAlias } from '../utils/bibleBooks'
import { useApi } from '../api/context'

interface LineData {
  id: string
  text: string
  indent: number
  // Set when this line was hydrated from an existing persisted note. The
  // reconciling save diffs against these ids: carried lines whose content or
  // indent changed are updated (preserving created_at); lines without an id are
  // created; notes whose line vanished are deleted. This is what keeps note ids
  // and the subtle timestamps stable across an edit — no delete-all/recreate.
  noteId?: string
}

export interface StudyModeHandle {
  isDirty: () => boolean
  save: () => Promise<string | null>
}

interface StudyModeProps {
  initialReference?: string
  initialPassageId?: string | null
  onSaveRead: (passageId: string) => void
  onSaveNext: (nextReference?: string) => void
}

function guessNextReference(label: string): string {
  const m = /^(.*?)(\d+):(\d+)(?:-(\d+))?$/.exec(label.trim())
  if (!m) return ''
  const bookPart = m[1].trim()
  const ch = parseInt(m[2], 10)
  const vs = parseInt(m[3], 10)
  const ve = m[4] ? parseInt(m[4], 10) : vs
  const len = ve - vs
  return `${bookPart} ${ch}:${ve + 1}-${ve + 1 + len}`
}

const StudyMode = forwardRef<StudyModeHandle, StudyModeProps>(function StudyMode({
  initialReference = '',
  initialPassageId = null,
  onSaveRead,
  onSaveNext
}, ref) {
  const api = useApi()
  const [reference, setReference] = useState(initialReference)
  const [passage, setPassage] = useState<BiblePassage | null>(null)
  const [loadingPassage, setLoadingPassage] = useState(false)
  const [lines, setLines] = useState<LineData[]>([{ id: makeLineId(), text: '', indent: 0 }])
  const [focusedLineId, setFocusedLineId] = useState<string | null>(lines[0].id)
  const [highlightedVerses, setHighlightedVerses] = useState<Set<number>>(new Set())
  const [hasHighlight, setHasHighlight] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editSessionId, setEditSessionId] = useState<string | null>(null)
  // The notes this study opened with, keyed by id — the baseline the reconciling
  // save diffs against (to know what changed and what was removed).
  const [existingNotes, setExistingNotes] = useState<Map<string, Note>>(new Map())
  const [noteFocusNonce, setNoteFocusNonce] = useState(0)
  // Mobile only: the pinned scripture panel starts collapsed (peek) so the notes
  // get the room; tap the header to expand. Ignored by the desktop side-by-side
  // layout, which shows the full pane regardless.
  const [scriptureExpanded, setScriptureExpanded] = useState(false)

  useEffect(() => {
    if (initialReference) {
      loadPassageByReference(initialReference)
    }
  }, [])

  // Opening an existing passage (from the Journal, the reading-view bridge, or
  // search): hydrate the editor from the passage's notes and load its scripture.
  // Notes are read across ALL of the passage's sessions in stable created_at
  // order so nothing is silently dropped when a passage has more than one
  // session; new notes on save write to the first (oldest) session. Each
  // hydrated line carries its source note id for the reconciling save.
  useEffect(() => {
    if (!initialPassageId) return
    let cancelled = false
    async function loadExisting(): Promise<void> {
      const passageRecord = await api.getPassageById(initialPassageId!)
      if (cancelled) return
      if (passageRecord) {
        setReference(passageRecord.reference_label)
        void loadPassageByReference(passageRecord.reference_label)
      }
      const sessionList = await api.getSessionsByPassage(initialPassageId!)
      if (cancelled || sessionList.length === 0) return
      // getSessionsByPassage returns newest-first; the write target is the
      // oldest session, matching the append behaviour elsewhere.
      const writeSession = sessionList[sessionList.length - 1]
      setEditSessionId(writeSession.id)
      const noteLists = await Promise.all(
        sessionList.map(s => api.getNotesBySession(s.id))
      )
      if (cancelled) return
      const allNotes = noteLists
        .flat()
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      if (allNotes.length > 0) {
        setExistingNotes(new Map(allNotes.map(n => [n.id, n])))
        setLines(allNotes.map(n => ({
          id: makeLineId(),
          text: n.content,
          indent: n.indent_level ?? 0,
          noteId: n.id
        })))
        setFocusedLineId(null)
      }
    }
    void loadExisting()
    return () => { cancelled = true }
  }, [initialPassageId])

  async function loadPassageByReference(ref: string): Promise<void> {
    if (!ref.trim()) return
    setLoadingPassage(true)
    try {
      const result = await api.getBibleVerse(ref.trim())
      if (result) setPassage(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPassage(false)
    }
  }

  // Reference-commit (Enter/Tab in the field): validate the reference
  // *synchronously*, move focus to the first note line immediately, and kick the
  // verse fetch off in the background. Returns false on parse failure so the
  // ReferenceInput keeps focus and shows its error — focus never moves on async.
  const commitReference = useCallback((ref: string): boolean => {
    const trimmed = ref.trim()
    if (!trimmed || !parseReferenceLabel(trimmed)) return false
    setFocusedLineId(lines[0].id)
    setNoteFocusNonce(n => n + 1)
    void loadPassageByReference(trimmed)
    return true
  }, [lines])

  const handleCursorLine = useCallback((parsed: ReturnType<typeof parseNoteLine> | null) => {
    if (!parsed || !passage) {
      setHighlightedVerses(new Set())
      setHasHighlight(false)
      return
    }
    if (parsed.anchorStart !== null) {
      const start = parsed.anchorStart
      const end = parsed.anchorEnd ?? start
      const vSet = new Set<number>()
      for (let v = start; v <= end; v++) vSet.add(v)
      setHighlightedVerses(vSet)
      setHasHighlight(true)
    } else {
      setHighlightedVerses(new Set())
      setHasHighlight(false)
    }
  }, [passage])

  // Reconciling save: diff the editor lines against the notes this study opened
  // with (existingNotes) rather than deleting-all-then-recreating. Lines that
  // carry a noteId are matched to their source note — updated only when content
  // or indent actually changed (so unchanged notes keep their updated_at, and
  // the subtle timestamp doesn't reset to "just now"). New lines are created,
  // notes whose line was removed are deleted. New notes go to writeSessionId.
  async function reconcileNotes(writeSessionId: string): Promise<void> {
    const kept = new Set<string>()
    for (const line of lines) {
      const text = line.text.trim()
      const parsed = parseNoteLine(line.text)
      if (line.noteId && existingNotes.has(line.noteId)) {
        const src = existingNotes.get(line.noteId)!
        if (!text) {
          // An existing note emptied out → remove it (handled by the deletion
          // sweep below, since it won't be in `kept`).
          continue
        }
        kept.add(line.noteId)
        const changed = src.content !== line.text || (src.indent_level ?? 0) !== line.indent
        if (changed) {
          await api.updateNote(line.noteId, {
            content: line.text,
            anchor_start_verse: parsed.anchorStart,
            anchor_end_verse: parsed.anchorEnd,
            category: parsed.category,
            indent_level: line.indent
          })
        }
      } else if (text) {
        await api.createNote({
          session_id: writeSessionId,
          content: line.text,
          anchor_start_verse: parsed.anchorStart,
          anchor_end_verse: parsed.anchorEnd,
          anchor_book_override: null,
          anchor_chapter_override: null,
          category: parsed.category,
          indent_level: line.indent
        })
      }
    }
    // Deletion sweep: any note we opened with that no longer has a kept line.
    for (const id of existingNotes.keys()) {
      if (!kept.has(id)) await api.deleteNote(id)
    }
  }

  // Resolve the passage + write session, creating them for a blank study. For an
  // existing passage we REUSE it (no duplicate passage created on open/save).
  async function ensureIds(): Promise<{ passageId: string; sessionId: string } | null> {
    if (initialPassageId) {
      let sessionId: string
      if (editSessionId) {
        sessionId = editSessionId
      } else {
        const sessions = await api.getSessionsByPassage(initialPassageId)
        if (sessions.length > 0) {
          sessionId = sessions[sessions.length - 1].id
        } else {
          const session = await api.createSession(initialPassageId)
          sessionId = session.id
        }
      }
      return { passageId: initialPassageId, sessionId }
    }
    if (!reference.trim()) return null
    const parsed = parseReferenceLabel(reference)
    if (!parsed) return null
    const bookNameMatch = reference.trim().match(/^([\d\s]?[a-zA-Z\s]+?)(?=\s+\d)/)
    const bookName = bookNameMatch ? bookNameMatch[1].trim() : ''
    const bookInfo = findBookByAlias(bookName)
    const newPassage = await api.createPassage({
      book_number: bookInfo?.number ?? 1,
      chapter_start: parsed.chapter_start,
      verse_start: parsed.verse_start,
      chapter_end: parsed.chapter_end,
      verse_end: parsed.verse_end,
      reference_label: reference.trim()
    })
    const session = await api.createSession(newPassage.id)
    return { passageId: newPassage.id, sessionId: session.id }
  }

  useImperativeHandle(ref, () => ({
    isDirty: () => {
      // A hydrated study is dirty when any line diverges from its source note,
      // or a note was removed; a blank study is dirty once any text is entered.
      if (existingNotes.size > 0) {
        const kept = new Set<string>()
        for (const l of lines) {
          if (l.noteId && existingNotes.has(l.noteId)) {
            kept.add(l.noteId)
            const src = existingNotes.get(l.noteId)!
            if (src.content !== l.text || (src.indent_level ?? 0) !== l.indent) return true
          } else if (l.text.trim() !== '') {
            return true
          }
        }
        return kept.size !== existingNotes.size
      }
      return lines.some(l => l.text.trim() !== '')
    },
    save: async () => {
      const ids = await ensureIds()
      if (!ids) return null
      await reconcileNotes(ids.sessionId)
      return ids.passageId
    }
  }), [lines, reference, existingNotes, editSessionId])

  const handleSaveRead = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const ids = await ensureIds()
      if (!ids) return
      await reconcileNotes(ids.sessionId)
      onSaveRead(ids.passageId)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNext = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const ids = await ensureIds()
      if (!ids) return
      await reconcileNotes(ids.sessionId)
      const nextRef = guessNextReference(reference)
      onSaveNext(nextRef)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`study-layout${scriptureExpanded ? ' study-layout--scripture-expanded' : ''}`}>
      <div className="study-left">
        <div className="passage-heading-wrap">
          <ReferenceInput
            className="passage-heading-input"
            value={reference}
            onChange={setReference}
            onSubmit={commitReference}
            placeholder="e.g. 1 Corinthians 7:1-15"
          />
          <div className="passage-heading-hint">Press Enter or Tab to load verse text</div>
        </div>

        <NoteEditor
          lines={lines}
          focusedLineId={focusedLineId}
          onChange={setLines}
          onFocusChange={setFocusedLineId}
          onCursorLine={handleCursorLine}
          focusNonce={noteFocusNonce}
        />

        <div className="study-actions">
          <button
            className="btn-action btn-save-read"
            onClick={handleSaveRead}
            disabled={saving || !reference.trim()}
          >
            {saving ? (
              'Saving…'
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Save & Read
              </>
            )}
          </button>
          <button
            className="btn-action btn-save-next"
            onClick={handleSaveNext}
            disabled={saving || !reference.trim()}
          >
            Save & Next
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="study-right">
        {/* Mobile-only collapse toggle. On desktop the pane is always fully
            shown (this header is hidden via CSS). Scripture stays pinned at the
            top on mobile and never scrolls fully off-screen. */}
        <button
          type="button"
          className="study-scripture-toggle"
          aria-expanded={scriptureExpanded}
          onClick={() => setScriptureExpanded(v => !v)}
        >
          <span className="study-scripture-toggle-label">
            {passage ? passage.reference : 'Scripture'}
          </span>
          <span className="study-scripture-toggle-hint">
            {scriptureExpanded ? 'Tap to collapse' : 'Tap to expand'}
          </span>
          <svg
            className={`study-scripture-chevron${scriptureExpanded ? ' expanded' : ''}`}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div className="study-scripture-body">
          <PassagePane
            passage={passage}
            loading={loadingPassage}
            highlightedVerses={highlightedVerses}
            hasAnyHighlight={hasHighlight}
          />
        </div>
      </div>
    </div>
  )
})

export default StudyMode
