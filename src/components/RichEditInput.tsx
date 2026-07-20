/**
 * Contenteditable note editor for inline editing in reading view.
 * Renders pills (verse anchors, tags, cross-refs) exactly like study mode,
 * with the same @tag autocomplete dropdown.
 * Cmd/Ctrl+Enter → save, Escape → cancel.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { getRawText, getRawCursorPos, setRawCursorPos, renderRich } from '../utils/richText'

interface TagOption {
  name: string
  colorClass: string
}

const TAG_OPTIONS: TagOption[] = [
  { name: 'observation', colorClass: 'observation' },
  { name: 'historical', colorClass: 'historical' },
  { name: 'application', colorClass: 'application' },
  { name: 'personal', colorClass: 'personal' }
]

interface DropdownState {
  query: string
  anchorIndex: number
  cursorPos: number
  activeIdx: number
}

interface RichEditInputProps {
  initialValue: string
  onChange: (val: string) => void
  onSave: () => void
  onCancel: () => void
  className?: string
}

export default function RichEditInput({
  initialValue,
  onChange,
  onSave,
  onCancel,
  className
}: RichEditInputProps): React.ReactElement {
  const elRef = useRef<HTMLDivElement>(null)
  const [dropdown, setDropdown] = useState<DropdownState | null>(null)

  const filteredTags = dropdown
    ? TAG_OPTIONS.filter(t => t.name.startsWith(dropdown.query.toLowerCase()))
    : []
  const isOpen = filteredTags.length > 0

  // Render initial value with pills and place cursor at end
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    renderRich(el, initialValue)
    el.focus()
    setRawCursorPos(el, initialValue.length)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectTag = useCallback(
    (tag: TagOption): void => {
      const el = elRef.current
      if (!el || !dropdown) return
      const text = getRawText(el)
      const before = text.slice(0, dropdown.anchorIndex)
      const after = text.slice(dropdown.cursorPos)
      const insertion = `@${tag.name} `
      const newText = before + insertion + after
      onChange(newText)
      renderRich(el, newText)
      setRawCursorPos(el, before.length + insertion.length)
      setDropdown(null)
      el.focus()
    },
    [dropdown, onChange]
  )

  const handleInput = (): void => {
    const el = elRef.current
    if (!el) return
    const cursorPos = getRawCursorPos(el)
    const text = getRawText(el)
    onChange(text)
    renderRich(el, text, cursorPos)
    setRawCursorPos(el, cursorPos)

    const before = text.slice(0, cursorPos)
    const m = /@(\w*)$/.exec(before)
    if (m) {
      setDropdown({ query: m[1], anchorIndex: m.index, cursorPos, activeIdx: 0 })
    } else {
      setDropdown(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (isOpen && dropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setDropdown(d =>
          d ? { ...d, activeIdx: Math.min(d.activeIdx + 1, filteredTags.length - 1) } : d
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setDropdown(d => (d ? { ...d, activeIdx: Math.max(d.activeIdx - 1, 0) } : d))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const tag = filteredTags[dropdown.activeIdx] ?? filteredTags[0]
        if (tag) selectTag(tag)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDropdown(null)
        return
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      onSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDropdown(null)
      onCancel()
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent): void => {
      if (!elRef.current?.parentElement?.contains(e.target as Node)) setDropdown(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={elRef}
        contentEditable
        suppressContentEditableWarning
        className={className}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          outline: 'none',
          minHeight: '1.6em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          cursor: 'text'
        }}
      />
      {isOpen && (
        <div className="tag-dropdown" style={{ left: 0 }}>
          {filteredTags.map((tag, i) => (
            <div
              key={tag.name}
              className={`tag-dropdown-item${i === dropdown?.activeIdx ? ' active' : ''}`}
              onMouseDown={e => {
                e.preventDefault()
                selectTag(tag)
              }}
              onMouseEnter={() => setDropdown(d => (d ? { ...d, activeIdx: i } : d))}
            >
              <span className={`tag-dropdown-swatch swatch-${tag.colorClass}`} />
              <span className="tag-dropdown-label">@{tag.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
