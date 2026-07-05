import React, { useEffect, useRef, useState } from 'react'
import { useApi } from '../api/context'

// A cross-reference pill that previews the referenced verse text.
//
// - On devices that have hover (desktop): hovering opens the preview, leaving
//   closes it — unchanged from the original behavior.
// - On touch devices (no hover): the pill is a tap-to-toggle popover. Tapping
//   opens it and fetches the verse; tapping again, or tapping anywhere outside,
//   closes it.
//
// We detect hover capability with `matchMedia('(hover: hover)')` rather than a
// user-agent sniff, so a desktop with a touchscreen still gets both.

const canHover = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover)').matches

export default function CrossRefPill({
  reference,
  display
}: {
  reference: string
  display: string
}): React.ReactElement {
  const api = useApi()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const spanRef = useRef<HTMLSpanElement>(null)
  const hover = useRef(canHover())

  const load = async (): Promise<void> => {
    if (text !== null) return
    const result = await api.getBibleVerse(reference)
    if (result) setText(result.text)
  }

  const show = (): void => {
    setOpen(true)
    void load()
  }
  const hide = (): void => setOpen(false)

  // Touch: dismiss on outside tap / escape while open.
  useEffect(() => {
    if (!open || hover.current) return
    const onDown = (e: PointerEvent | MouseEvent): void => {
      if (!spanRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span
      ref={spanRef}
      className="pill-crossref"
      style={{ position: 'relative' }}
      onMouseEnter={hover.current ? show : undefined}
      onMouseLeave={hover.current ? hide : undefined}
      onClick={
        hover.current
          ? undefined
          : e => {
              e.stopPropagation()
              if (open) setOpen(false)
              else show()
            }
      }
    >
      {display}
      {open && (
        <div className="crossref-hover-card">
          <div className="ref-label">{reference}</div>
          {text ?? 'Loading…'}
        </div>
      )}
    </span>
  )
}
