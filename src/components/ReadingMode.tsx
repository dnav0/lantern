import React, { useState, useEffect, useCallback } from 'react'
import { Passage, Note, BiblePassage, NoteCategory } from '../types'
import { parseNoteLine } from '../utils/noteParser'
import { useApi } from '../api/context'
import InlineTagInput from './InlineTagInput'
import RichEditInput from './RichEditInput'
import ConfirmDialog from './ConfirmDialog'
import CrossRefPill from './CrossRefPill'

interface ReadingModeProps {
  passage: Passage
  onCapture: (passageId: string) => void
  onRefresh?: () => void
  // The bridge: jump from a note into the full study (SessionEditor flow).
  onOpenStudy?: () => void
  onPassageDeleted?: () => void
}

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  observation: 'Observation',
  historical: 'Historical',
  application: 'Application',
  personal: 'Personal'
}

interface NoteGroup {
  main: Note
  subnotes: Note[]
}

function RenderedNoteContent({ content }: { content: string }): React.ReactElement {
  const { segments } = parseNoteLine(content)
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'verse-anchor':
            return <span key={i} className="pill-verse">{seg.display}</span>
          case 'tag':
            return null
          case 'cross-ref':
            return <CrossRefPill key={i} reference={seg.data?.reference ?? seg.raw} display={seg.display} />
          default:
            return <span key={i}>{seg.raw}</span>
        }
      })}
    </>
  )
}

export default function ReadingMode({ passage, onCapture, onRefresh, onOpenStudy, onPassageDeleted }: ReadingModeProps): React.ReactElement {
  const api = useApi()
  const [biblePassage, setBiblePassage] = useState<BiblePassage | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightedNoteIds, setHighlightedNoteIds] = useState<Set<string>>(new Set())
  const [highlightedVerses, setHighlightedVerses] = useState<Set<number>>(new Set())
  const [inlineVerse, setInlineVerse] = useState<number | null>(null)
  const [inlineText, setInlineText] = useState('')
  const [savingInline, setSavingInline] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null)

  useEffect(() => {
    setLoading(true)
    setBiblePassage(null)
    setNotes([])
    setHighlightedNoteIds(new Set())
    setHighlightedVerses(new Set())
    setEditingNoteId(null)

    Promise.all([
      api.getBibleVerse(passage.reference_label),
      api.getNotesByPassage(passage.id)
    ]).then(([bp, ns]) => {
      if (bp) setBiblePassage(bp)
      setNotes(ns)
    }).finally(() => setLoading(false))
  }, [passage.id])

  const notesByVerse = useCallback((): Map<number | null, NoteGroup[]> => {
    const map = new Map<number | null, NoteGroup[]>()
    const sorted = [...notes].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    let currentGroup: NoteGroup | null = null
    for (const note of sorted) {
      if (note.indent_level === 0) {
        currentGroup = { main: note, subnotes: [] }
        const key = note.anchor_start_verse
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(currentGroup)
      } else if (currentGroup) {
        currentGroup.subnotes.push(note)
      } else {
        currentGroup = { main: note, subnotes: [] }
        const key = note.anchor_start_verse
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(currentGroup)
      }
    }
    return map
  }, [notes])

  const handleNoteClick = (note: Note): void => {
    if (editingNoteId !== null) return
    if (note.anchor_start_verse !== null) {
      const start = note.anchor_start_verse
      const end = note.anchor_end_verse ?? start
      const vSet = new Set<number>()
      for (let v = start; v <= end; v++) vSet.add(v)
      setHighlightedVerses(vSet)
      setHighlightedNoteIds(new Set())
    }
  }

  const handleVerseClick = (verseNum: number): void => {
    const anchored = notes.filter(n =>
      n.anchor_start_verse !== null &&
      verseNum >= n.anchor_start_verse &&
      verseNum <= (n.anchor_end_verse ?? n.anchor_start_verse)
    )
    if (anchored.length > 0) {
      setHighlightedNoteIds(new Set(anchored.map(n => n.id)))
      setHighlightedVerses(new Set())
    }
  }

  const handleAddInline = (verseNum: number): void => {
    setInlineVerse(verseNum)
    setInlineText(`v${verseNum} `)
    setEditingNoteId(null)
  }

  const handleInlineSave = async (): Promise<void> => {
    if (!inlineText.trim() || savingInline) return
    setSavingInline(true)
    try {
      const parsed = parseNoteLine(inlineText)
      const sessions = await api.getSessionsByPassage(passage.id)
      let sessionId: string
      if (sessions.length > 0) {
        sessionId = sessions[0].id
      } else {
        const session = await api.createSession(passage.id)
        sessionId = session.id
      }
      const note = await api.createNote({
        session_id: sessionId,
        content: inlineText,
        anchor_start_verse: parsed.anchorStart,
        anchor_end_verse: parsed.anchorEnd,
        anchor_book_override: null,
        anchor_chapter_override: null,
        category: parsed.category,
        indent_level: 0
      })
      setNotes(prev => [...prev, note])
      setInlineVerse(null)
      setInlineText('')
      onRefresh?.()
    } finally {
      setSavingInline(false)
    }
  }

  const handleStartEdit = (note: Note): void => {
    setEditingNoteId(note.id)
    setEditText(note.content)
    setInlineVerse(null)
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (editingNoteId === null || !editText.trim()) return
    const parsed = parseNoteLine(editText)
    const updated = await api.updateNote(editingNoteId, {
      content: editText,
      anchor_start_verse: parsed.anchorStart,
      anchor_end_verse: parsed.anchorEnd,
      category: parsed.category
    })
    setNotes(prev => prev.map(n => n.id === editingNoteId ? updated : n))
    setEditingNoteId(null)
    onRefresh?.()
  }

  const handleDeleteNote = async (note: Note): Promise<void> => {
    const result = await api.deleteNoteAndCascade(note.id)
    setNotes(prev => prev.filter(n => n.id !== note.id))
    setConfirmDelete(null)
    onRefresh?.()
    if (result.deletedPassageId) {
      onPassageDeleted?.()
    }
  }

  if (loading) {
    return (
      <div className="reading-layout">
        <div className="reading-content">
          <div className="loading-dots">Loading…</div>
        </div>
      </div>
    )
  }

  const byVerse = notesByVerse()
  const hasAnyHighlightedVerse = highlightedVerses.size > 0

  const renderNoteActions = (note: Note): React.ReactElement => (
    <div className="se-note-actions">
      <button className="se-icon-btn" title="Edit note" onClick={e => { e.stopPropagation(); handleStartEdit(note) }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      {onOpenStudy && (
        <button className="se-icon-btn" title="Open study" onClick={e => { e.stopPropagation(); onOpenStudy() }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </button>
      )}
      <button className="se-icon-btn se-icon-danger" title="Delete" onClick={e => { e.stopPropagation(); setConfirmDelete(note) }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
      </button>
    </div>
  )

  const renderNoteGroup = (group: NoteGroup): React.ReactElement => {
    const { main, subnotes } = group
    const isHighlighted = highlightedNoteIds.has(main.id)
    const isEditing = editingNoteId === main.id
    return (
      <div
        key={main.id}
        className={`reading-note-card cat-${main.category || 'none'}${isHighlighted ? ' highlighted' : ''}`}
      >
        {main.category && (
          <div className={`reading-note-meta cat-${main.category}`}>
            {CATEGORY_LABELS[main.category]}
          </div>
        )}
        {isEditing ? (
          <div style={{ marginTop: 2 }}>
            <RichEditInput className="note-edit-textarea" initialValue={editText} onChange={setEditText} onSave={() => void handleSaveEdit()} onCancel={() => setEditingNoteId(null)} />
            <div className="note-edit-actions">
              <button className="note-edit-cancel" onClick={() => setEditingNoteId(null)}>Cancel</button>
              <button className="note-edit-save" onClick={() => void handleSaveEdit()}>Save</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ flex: 1 }} onClick={() => handleNoteClick(main)}>
              <RenderedNoteContent content={main.content} />
            </div>
            {renderNoteActions(main)}
          </div>
        )}

        {subnotes.length > 0 && (
          <div className="reading-subnotes">
            {subnotes.map(sub => {
              const isSubEditing = editingNoteId === sub.id
              return (
                <div key={sub.id} className={`reading-subnote${highlightedNoteIds.has(sub.id) ? ' highlighted' : ''}`}>
                  <span className="reading-subnote-bullet">◦</span>
                  {isSubEditing ? (
                    <div style={{ flex: 1 }}>
                      <RichEditInput className="note-edit-textarea" initialValue={editText} onChange={setEditText} onSave={() => void handleSaveEdit()} onCancel={() => setEditingNoteId(null)} />
                      <div className="note-edit-actions">
                        <button className="note-edit-cancel" onClick={() => setEditingNoteId(null)}>Cancel</button>
                        <button className="note-edit-save" onClick={() => void handleSaveEdit()}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1 }} onClick={() => handleNoteClick(sub)}>
                        {sub.category && (
                          <div className={`reading-subnote-meta cat-${sub.category}`}>
                            {CATEGORY_LABELS[sub.category]}
                          </div>
                        )}
                        <RenderedNoteContent content={sub.content} />
                      </div>
                      {renderNoteActions(sub)}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="reading-layout">
      <div className="reading-content fade-in">
        {/* Heading */}
        <div className="reading-heading">
          <h1>{passage.reference_label}</h1>
          <div className="reading-meta">
            <span>{passage.session_count ?? 0} session{passage.session_count !== 1 ? 's' : ''}</span>
            {passage.last_studied && (
              <span>Last studied {new Date(passage.last_studied).toLocaleDateString()}</span>
            )}
            <span
              style={{ color: '#7F77DD', cursor: 'pointer', marginLeft: 'auto' }}
              onClick={() => onCapture(passage.id)}
            >
              Edit notes
            </span>
          </div>
        </div>

        {biblePassage ? (
          <>
            {biblePassage.verses.map(v => {
              const isHighlighted = highlightedVerses.has(v.verse)
              const isDimmed = hasAnyHighlightedVerse && !isHighlighted
              const verseNotes = byVerse.get(v.verse) || [] as NoteGroup[]
              const showInline = inlineVerse === v.verse

              return (
                <div key={v.verse} className="reading-verse-block">
                  <div
                    className={`reading-verse-row${isHighlighted ? ' highlighted' : ''}`}
                    onClick={() => handleVerseClick(v.verse)}
                    style={isDimmed ? { opacity: 0.35 } : undefined}
                  >
                    <span className="verse-number">{v.verse}</span>
                    <span className="verse-text">{v.text}</span>
                    <span
                      className="verse-add-btn"
                      onClick={e => { e.stopPropagation(); handleAddInline(v.verse) }}
                      title="Add note"
                    >
                      +
                    </span>
                  </div>

                  {showInline && (
                    <div className="inline-note-row">
                      <span style={{ color: '#CCC', fontSize: 14 }}>•</span>
                      <InlineTagInput
                        value={inlineText}
                        onChange={setInlineText}
                        onEnter={handleInlineSave}
                        onEscape={() => { setInlineVerse(null); setInlineText('') }}
                        className="inline-note-input"
                        placeholder={`v${v.verse} type a note…`}
                        autoFocus
                      />
                      <span className="inline-note-hint">↵ save · esc cancel</span>
                    </div>
                  )}

                  {verseNotes.length > 0 && (
                    <div className="reading-notes-group">
                      {verseNotes.map(group => renderNoteGroup(group))}
                    </div>
                  )}
                </div>
              )
            })}

            {(byVerse.get(null) || []).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="passage-pane-reference" style={{ marginBottom: 8 }}>General Notes</div>
                <div className="reading-notes-group">
                  {(byVerse.get(null) || []).map(group => renderNoteGroup(group))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#CCC', fontSize: 13 }}>Verse text not available.</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Delete note?"
        message={confirmDelete ? `"${confirmDelete.content.slice(0, 60)}${confirmDelete.content.length > 60 ? '…' : ''}"` : undefined}
        onClose={() => setConfirmDelete(null)}
        actions={[
          { label: 'Delete', variant: 'danger', onClick: () => confirmDelete && void handleDeleteNote(confirmDelete), autoFocus: false },
          { label: 'Cancel', variant: 'ghost', onClick: () => setConfirmDelete(null), autoFocus: true }
        ]}
      />
    </div>
  )
}
