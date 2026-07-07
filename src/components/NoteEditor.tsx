import React, { useRef, useEffect, useCallback, useState } from 'react'
import { NoteCategory } from '../types'
import { parseNoteLine } from '../utils/noteParser'
import { decideEnter, decideBackspace } from '../utils/noteKeydown'
import { getRawText, getRawCursorPos, setRawCursorPos, renderRich } from '../utils/richText'
import CrossRefPill from './CrossRefPill'

// ─── types ───────────────────────────────────────────────────────────────────

export interface NoteLineData {
  id: string
  text: string
  indent: number
}

interface TagOption {
  name: NoteCategory
  label: string
  colorClass: string
}

const TAG_OPTIONS: TagOption[] = [
  { name: 'observation', label: 'observation', colorClass: 'observation' },
  { name: 'historical',  label: 'historical',  colorClass: 'historical'  },
  { name: 'application', label: 'application', colorClass: 'application' },
  { name: 'personal',    label: 'personal',    colorClass: 'personal'    },
]

interface TagDropdown {
  lineId: string
  query: string
  anchorIndex: number
  cursorPos: number
  activeIdx: number
}

let lineIdCounter = 0
export function makeLineId(): string { return `ln-${++lineIdCounter}` }

// One-time discoverability hint on first note-line focus. localStorage is fine —
// this is pure web and the flag is non-critical (worst case the hint reappears).
const HINT_SEEN_KEY = 'berean.noteHintSeen'
function hintAlreadySeen(): boolean {
  try { return localStorage.getItem(HINT_SEEN_KEY) === '1' } catch { return true }
}
function markHintSeen(): void {
  try { localStorage.setItem(HINT_SEEN_KEY, '1') } catch { /* ignore */ }
}

// Tap-to-insert chips for the mobile chip row. Same data model as typing the
// tokens by hand — an input method only, no new schema.
interface ChipOption { label: string; insert: string }
const CHIP_OPTIONS: ChipOption[] = [
  { label: 'v', insert: 'v' },
  { label: '@observation', insert: '@observation ' },
  { label: '@historical', insert: '@historical ' },
  { label: '@application', insert: '@application ' },
  { label: '@personal', insert: '@personal ' },
]

function filterTags(q: string): TagOption[] {
  return TAG_OPTIONS.filter(t => t.name.startsWith(q.toLowerCase()))
}

/**
 * The bottom edge of the usable viewport. On mobile the soft keyboard covers the
 * lower part of the layout viewport; the visualViewport API reports the smaller,
 * un-occluded region, so its (offsetTop + height) is the real bottom the caret
 * must stay above. Falls back to window.innerHeight where the API is absent.
 */
function usableViewportBottom(): number {
  const vv = window.visualViewport
  if (vv) return vv.offsetTop + vv.height
  return window.innerHeight
}

/**
 * Smooth-scroll the notes list so the focused line is comfortably visible.
 * Triggers when the line is in the bottom third of the scrollable container,
 * or when it's above the top edge. Scrolls just enough to place it at ~60%
 * from the top — feels natural without aggressively centering every line.
 *
 * `keyboardAware` clamps the effective container bottom to the visualViewport
 * bottom so the caret stays above the on-screen keyboard (mobile). Desktop and
 * keyboard-closed states are unaffected because the viewport bottom sits below
 * the container.
 */
function scrollLineIntoView(lineEl: HTMLElement, keyboardAware = false): void {
  const container = lineEl.closest('.notes-list') as HTMLElement | null
  if (!container) return
  const lineRect = lineEl.getBoundingClientRect()
  const cRect = container.getBoundingClientRect()

  // Effective bottom of the visible area: the smaller of the container's own
  // bottom and the keyboard-clamped viewport bottom.
  const effectiveBottom = keyboardAware
    ? Math.min(cRect.bottom, usableViewportBottom())
    : cRect.bottom
  const visibleHeight = effectiveBottom - cRect.top
  if (visibleHeight <= 0) return

  if (lineRect.bottom > cRect.top + visibleHeight * 0.4) {
    const delta = lineRect.bottom - cRect.top - visibleHeight * 0.3
    container.scrollBy({ top: delta, behavior: 'smooth' })
  } else if (lineRect.top < cRect.top) {
    container.scrollBy({ top: lineRect.top - cRect.top - 8, behavior: 'smooth' })
  }
}

// ─── RenderedLine (unfocused view with cross-ref hover) ───────────────────────

function RenderedLine({ text }: { text: string }): React.ReactElement {
  if (!text) return <span style={{ color: '#DDD' }}>&nbsp;</span>

  const { segments } = parseNoteLine(text)
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'verse-anchor') {
          return <span key={i} className="pill-verse">{seg.display}</span>
        }
        if (seg.type === 'tag') {
          return <span key={i} className={`pill-tag-${seg.data?.category ?? 'observation'}`}>{seg.display}</span>
        }
        if (seg.type === 'cross-ref') {
          const ref = seg.data?.reference ?? seg.raw
          return <CrossRefPill key={i} reference={ref} display={seg.display} />
        }
        return <span key={i}>{seg.raw}</span>
      })}
    </>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface NoteEditorProps {
  lines: NoteLineData[]
  focusedLineId: string | null
  onChange: (lines: NoteLineData[]) => void
  onFocusChange: (id: string | null) => void
  onCursorLine: (parsed: ReturnType<typeof parseNoteLine> | null) => void
  /**
   * Bump to imperatively move DOM focus to the currently `focusedLineId` line
   * (used by the reference-commit flow). A nonce so the same target can be
   * re-focused on demand without an extra id.
   */
  focusNonce?: number
}

export default function NoteEditor({
  lines,
  focusedLineId,
  onChange,
  onFocusChange,
  onCursorLine,
  focusNonce
}: NoteEditorProps): React.ReactElement {
  const elRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [tagDropdown, setTagDropdown] = useState<TagDropdown | null>(null)
  const [showHint, setShowHint] = useState(false)

  // Imperative focus request (e.g. after committing the reference). Runs after
  // paint so the target line's contentEditable is mounted.
  useEffect(() => {
    if (!focusNonce || !focusedLineId) return
    requestAnimationFrame(() => {
      const el = elRefs.current.get(focusedLineId)
      if (el) {
        el.focus()
        setRawCursorPos(el, getRawText(el).length)
      }
    })
  }, [focusNonce, focusedLineId])

  // Keep the caret visible above the on-screen keyboard. The visualViewport
  // shrinks when the keyboard opens (and as it settles / rotates); on each of
  // those geometry changes we re-run the keyboard-aware scroll for the focused
  // line. This reconciles with scrollLineIntoView rather than duplicating it —
  // same helper, just clamped to the visualViewport bottom. No-op where the API
  // is unavailable (older/desktop browsers), so nothing to guard against there.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || !focusedLineId) return
    const onGeometryChange = (): void => {
      const el = elRefs.current.get(focusedLineId)
      const noteLine = el?.closest('.note-line') as HTMLElement | null
      if (noteLine) scrollLineIntoView(noteLine, true)
    }
    vv.addEventListener('resize', onGeometryChange)
    vv.addEventListener('scroll', onGeometryChange)
    return () => {
      vv.removeEventListener('resize', onGeometryChange)
      vv.removeEventListener('scroll', onGeometryChange)
    }
  }, [focusedLineId])

  const filteredTags = tagDropdown ? filterTags(tagDropdown.query) : []
  const hasDropdown = filteredTags.length > 0 && tagDropdown !== null

  // When an indented line is focused, merge parent's verse range so the passage
  // pane keeps highlighting the root verse context.
  const getEffectiveParsed = useCallback((lineId: string, text: string): ReturnType<typeof parseNoteLine> => {
    const parsed = parseNoteLine(text)
    const lineIdx = lines.findIndex(l => l.id === lineId)
    if (lineIdx < 0 || lines[lineIdx].indent === 0) return parsed
    const parent = lines.slice(0, lineIdx).reverse().find(l => l.indent === 0)
    if (!parent) return parsed
    const pp = parseNoteLine(parent.text)
    if (pp.anchorStart === null) return parsed
    const pStart = pp.anchorStart
    const pEnd = pp.anchorEnd ?? pStart
    const cStart = parsed.anchorStart
    const cEnd = cStart !== null ? (parsed.anchorEnd ?? cStart) : null
    const mergedStart = cStart !== null ? Math.min(pStart, cStart) : pStart
    const mergedEnd = cEnd !== null ? Math.max(pEnd, cEnd) : pEnd
    return { ...parsed, anchorStart: mergedStart, anchorEnd: mergedEnd !== mergedStart ? mergedEnd : null }
  }, [lines])

  // ── tag selection ──────────────────────────────────────────────────────────
  const selectTag = useCallback((tag: TagOption) => {
    if (!tagDropdown) return
    const { lineId, anchorIndex, cursorPos } = tagDropdown
    const line = lines.find(l => l.id === lineId)
    if (!line) return

    const before = line.text.slice(0, anchorIndex)
    const insertion = `@${tag.name} `
    const after = line.text.slice(cursorPos)
    const newText = before + insertion + after

    onChange(lines.map(l => l.id === lineId ? { ...l, text: newText } : l))
    setTagDropdown(null)
    onCursorLine(getEffectiveParsed(lineId, newText))

    setTimeout(() => {
      const el = elRefs.current.get(lineId)
      if (el) {
        renderRich(el, newText)
        el.focus()
        setRawCursorPos(el, before.length + insertion.length)
      }
    }, 0)
  }, [tagDropdown, lines, onChange, onCursorLine])

  // ── tap-to-insert (mobile chip row) ─────────────────────────────────────────
  // Inserts a token at the caret of the focused line, then restores focus/caret.
  // Same effect as typing the token — the data model is untouched.
  const insertAtCaret = useCallback((insert: string) => {
    const lineId = focusedLineId
    if (!lineId) return
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const el = elRefs.current.get(lineId)
    const caret = el ? getRawCursorPos(el) : line.text.length
    const before = line.text.slice(0, caret)
    const after = line.text.slice(caret)
    const newText = before + insert + after

    onChange(lines.map(l => l.id === lineId ? { ...l, text: newText } : l))
    onCursorLine(getEffectiveParsed(lineId, newText))

    setTimeout(() => {
      const target = elRefs.current.get(lineId)
      if (target) {
        renderRich(target, newText)
        target.focus()
        setRawCursorPos(target, before.length + insert.length)
      }
    }, 0)
  }, [focusedLineId, lines, onChange, onCursorLine, getEffectiveParsed])

  // First-use hint on first note-line focus.
  const handleNoteFocus = useCallback((lineId: string, text: string) => {
    onCursorLine(getEffectiveParsed(lineId, text))
    if (!hintAlreadySeen()) setShowHint(true)
  }, [onCursorLine, getEffectiveParsed])

  const dismissHint = useCallback(() => {
    markHintSeen()
    setShowHint(false)
  }, [])

  // ── input handler ──────────────────────────────────────────────────────────
  // Note: no useLayoutEffect — handleInput and selectTag own the DOM directly.
  // setRawCursorPos is only called when renderRich actually rewrote the DOM
  // (a token became a pill or a pill was deleted). For plain-text changes the
  // browser already placed the cursor correctly, so we leave it alone.
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>, id: string) => {
    const el = e.currentTarget
    const cur = getRawCursorPos(el)
    const text = getRawText(el)

    const modified = renderRich(el, text, cur)
    if (modified) setRawCursorPos(el, cur)

    onChange(lines.map(l => l.id === id ? { ...l, text } : l))
    onCursorLine(getEffectiveParsed(id, text))

    const before = text.slice(0, cur)
    const m = /@(\w*)$/.exec(before)
    if (m) {
      setTagDropdown({ lineId: id, query: m[1], anchorIndex: m.index, cursorPos: cur, activeIdx: 0 })
    } else {
      setTagDropdown(null)
    }

    // As the line wraps or grows while typing, keep the caret above the keyboard.
    const noteLine = el.closest('.note-line') as HTMLElement | null
    if (noteLine) scrollLineIntoView(noteLine, true)
  }, [lines, onChange, onCursorLine])

  // ── keydown ────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    const idx = lines.findIndex(l => l.id === id)
    const el = e.currentTarget

    if (hasDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setTagDropdown(d => d ? { ...d, activeIdx: Math.min(d.activeIdx + 1, filteredTags.length - 1) } : d)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setTagDropdown(d => d ? { ...d, activeIdx: Math.max(d.activeIdx - 1, 0) } : d)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const tag = filteredTags[tagDropdown!.activeIdx] ?? filteredTags[0]
        if (tag) selectTag(tag)
        return
      }
      if (e.key === 'Escape') {
        setTagDropdown(null)
        return
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const line = lines[idx]
      const newIndent = e.shiftKey
        ? Math.max(0, line.indent - 1)
        : Math.min(1, line.indent + 1)
      if (newIndent !== line.indent) {
        onChange(lines.map((l, i) => i === idx ? { ...l, indent: newIndent } : l))
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const line = lines[idx]
      const action = decideEnter({
        text: getRawText(el),
        indent: line.indent,
        caret: getRawCursorPos(el),
        lineCount: lines.length
      })
      if (action.type === 'noop') return
      if (action.type === 'outdent') {
        // Empty indented bullet: drop one level in place, keep focus/caret.
        onChange(lines.map((l, i) => i === idx ? { ...l, indent: line.indent - 1 } : l))
        return
      }
      const newId = makeLineId()
      onChange([...lines.slice(0, idx + 1), { id: newId, text: '', indent: line.indent }, ...lines.slice(idx + 1)])
      onFocusChange(newId)
      return
    }

    if (e.key === 'Backspace' && !e.metaKey && !e.altKey) {
      // Non-collapsed selection: let the browser delete it; handleInput syncs state.
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) return

      const text = getRawText(el)
      const line = lines[idx]

      // Empty indented bullet at the start → outdent one level in place first,
      // rather than deleting the line. Only collapses to line-removal at indent 0.
      if (decideBackspace({ text, indent: line.indent, caret: getRawCursorPos(el), lineCount: lines.length }).type === 'outdent') {
        e.preventDefault()
        onChange(lines.map((l, i) => i === idx ? { ...l, indent: line.indent - 1 } : l))
        return
      }

      if (text === '' && lines.length > 1) {
        // Empty line → remove it and move focus
        e.preventDefault()
        const prevId = lines[idx - 1]?.id ?? lines[idx + 1]?.id
        onChange(lines.filter(l => l.id !== id))
        if (prevId) {
          onFocusChange(prevId)
          setTimeout(() => {
            const prevEl = elRefs.current.get(prevId)
            if (prevEl) {
              prevEl.focus()
              setRawCursorPos(prevEl, getRawText(prevEl).length)
              const noteLine = prevEl.closest('.note-line') as HTMLElement | null
              if (noteLine) scrollLineIntoView(noteLine)
            }
          }, 0)
        }
        return
      }

      // Cursor at position 0 on a non-empty line → jump to end of previous line
      if (text !== '' && getRawCursorPos(el) === 0 && idx > 0) {
        e.preventDefault()
        const prevId = lines[idx - 1].id
        onFocusChange(prevId)
        setTimeout(() => {
          const prevEl = elRefs.current.get(prevId)
          if (prevEl) {
            prevEl.focus()
            setRawCursorPos(prevEl, getRawText(prevEl).length)
            const noteLine = prevEl.closest('.note-line') as HTMLElement | null
            if (noteLine) scrollLineIntoView(noteLine)
          }
        }, 0)
        return
      }
    }

    // Plain ArrowUp/Down navigate between bullet lines.
    // Shift/Cmd/Alt combos pass through for selection and word jumps.
    if (e.key === 'ArrowUp' && idx > 0 && !e.shiftKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      const prevId = lines[idx - 1].id
      onFocusChange(prevId)
      setTimeout(() => {
        const prevEl = elRefs.current.get(prevId)
        if (prevEl) {
          prevEl.focus()
          const noteLine = prevEl.closest('.note-line') as HTMLElement | null
          if (noteLine) scrollLineIntoView(noteLine)
        }
      }, 0)
      return
    }
    if (e.key === 'ArrowDown' && idx < lines.length - 1 && !e.shiftKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      const nextId = lines[idx + 1].id
      onFocusChange(nextId)
      setTimeout(() => {
        const nextEl = elRefs.current.get(nextId)
        if (nextEl) {
          nextEl.focus()
          const noteLine = nextEl.closest('.note-line') as HTMLElement | null
          if (noteLine) scrollLineIntoView(noteLine)
        }
      }, 0)
    }
  }, [lines, hasDropdown, filteredTags, tagDropdown, selectTag, onChange, onFocusChange])

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (![...elRefs.current.values()].includes(document.activeElement as HTMLDivElement)) {
        setTagDropdown(null)
        onCursorLine(null)
      }
    }, 80)
  }, [onCursorLine])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>, id: string) => {
    e.preventDefault()
    const pasteText = e.clipboardData.getData('text/plain')
    const el = e.currentTarget
    const cur = getRawCursorPos(el)
    const raw = getRawText(el)
    const newText = raw.slice(0, cur) + pasteText + raw.slice(cur)
    renderRich(el, newText)
    setRawCursorPos(el, cur + pasteText.length)
    onChange(lines.map(l => l.id === id ? { ...l, text: newText } : l))
    onCursorLine(getEffectiveParsed(id, newText))
  }, [lines, onChange, onCursorLine])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (!(e.target as Element)?.closest?.('.tag-dropdown')) {
        setTagDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="notes-list">
      {lines.map((line) => {
        const isFocused = focusedLineId === line.id
        const showDropdown = hasDropdown && tagDropdown?.lineId === line.id

        return (
          <div key={line.id} className={`note-line${line.indent > 0 ? ' note-line--indent-1' : ''}`} style={{ position: 'relative' }}>
            <span className="note-bullet">{line.indent > 0 ? '◦' : '•'}</span>

            {isFocused ? (
              <div
                key="editor"
                ref={el => {
                  if (el) {
                    elRefs.current.set(line.id, el)
                    if (!el.dataset.init) {
                      el.dataset.init = '1'
                      renderRich(el, line.text)
                      requestAnimationFrame(() => {
                        if (document.activeElement !== el) {
                          el.focus()
                          setRawCursorPos(el, getRawText(el).length)
                        }
                        const noteLine = el.closest('.note-line') as HTMLElement | null
                        if (noteLine) scrollLineIntoView(noteLine)
                      })
                    }
                  } else {
                    elRefs.current.delete(line.id)
                  }
                }}
                className="note-input note-richtext"
                contentEditable
                suppressContentEditableWarning
                onInput={e => handleInput(e, line.id)}
                onKeyDown={e => handleKeyDown(e, line.id)}
                onFocus={() => handleNoteFocus(line.id, line.text)}
                onBlur={handleBlur}
                onPaste={e => handlePaste(e, line.id)}
                data-placeholder="Type your note — @ for a category, v4 to tag verse 4"
              />
            ) : (
              <div
                key="rendered"
                className="note-rendered"
                onClick={() => onFocusChange(line.id)}
              >
                <RenderedLine text={line.text} />
              </div>
            )}

            {showDropdown && (
              <div className="tag-dropdown">
                {filteredTags.map((tag, i) => (
                  <div
                    key={tag.name}
                    className={`tag-dropdown-item${i === tagDropdown!.activeIdx ? ' active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); selectTag(tag) }}
                    onMouseEnter={() => setTagDropdown(d => d ? { ...d, activeIdx: i } : d)}
                  >
                    <span className={`tag-dropdown-swatch swatch-${tag.colorClass}`} />
                    <span className="tag-dropdown-label">@{tag.label}</span>
                  </div>
                ))}
              </div>
            )}

            {isFocused && showHint && (
              <div className="note-hint-popover" role="note">
                <span className="note-hint-text">
                  Tip: type <strong>@</strong> to tag a category, or <strong>v4</strong> to
                  anchor a note to verse 4. A reference like <strong>Matt 5:9</strong> becomes a link.
                </span>
                <button
                  type="button"
                  className="note-hint-dismiss"
                  onMouseDown={e => { e.preventDefault(); dismissHint() }}
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        )
      })}

      {focusedLineId !== null && (
        <div className="note-chip-row" role="toolbar" aria-label="Insert tag">
          {CHIP_OPTIONS.map(chip => (
            <button
              key={chip.label}
              type="button"
              className="note-chip"
              // preventDefault keeps focus/caret in the editor while inserting.
              onMouseDown={e => { e.preventDefault(); insertAtCaret(chip.insert) }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
