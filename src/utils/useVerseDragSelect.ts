import { useCallback, useEffect, useRef, useState } from 'react'

// Click-drag verse-range selection (desktop only — touch keeps the existing
// tap-anchor/tap-extend gesture untouched, see the `pointerType` guard below).
//
// The tension: dragging over verse TEXT collides with native text selection
// (drag-to-copy). Resolved by only *initiating* a drag-select from the verse
// NUMBER gutter (`.verse-number`) — the verse text itself is never a drag
// origin, so native text selection there keeps working exactly as before. A
// plain click (no movement past the threshold) on the gutter is deliberately
// left alone here: it still bubbles to the row's existing `onClick`
// (tap-anchor/tap-extend), so single-tap behavior is unchanged and this hook
// never double-fires it. Only once the pointer actually moves to a different
// verse row do we treat it as a drag and take over, committing the range via
// `onRangeSelected`. While an actual drag is in progress we set
// `document.body`'s `user-select: none` so a fast drag doesn't also select
// verse text out from under the pointer, then restore it on release.
//
// Why this is robust against the "selection drops to 0" failure mode: after a
// genuine cross-row drag, the browser's trailing `click` event fires on
// whatever DOM node is the common ancestor of pointerdown/pointerup targets —
// often the grid container, not a verse row — so a row's onClick may never
// run and a `justDragged` flag set only inside a row's click handler could
// linger stale and wrongly suppress the user's NEXT unrelated tap. To avoid
// that: (1) `justDragged` is reset the instant a new drag starts, so it can
// never persist across interactions, (2) the final range is committed
// eagerly on `pointerup` itself (not only from `pointerenter`), so a fast
// drag that outruns enter events still leaves `selAnchor`/`selFocus` set
// correctly, and (3) `suppressNextClick` is a one-shot consume — the very
// first click after a real drag is swallowed (whether it lands on the row or
// bubbles from the container) and every click after that behaves normally.
export function useVerseDragSelect(
  onRangeSelected: (start: number, end: number) => void
): {
  isDragging: boolean
  gutterPointerDown: (verse: number) => (e: React.PointerEvent) => void
  rowPointerEnter: (verse: number) => () => void
  suppressNextClick: () => boolean
} {
  const [isDragging, setIsDragging] = useState(false)
  const dragStartVerse = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const dragCurrentVerse = useRef<number | null>(null)
  // True for exactly one subsequent click after a drag that actually moved
  // across verses, so the native trailing `click` (which may land on the row,
  // the grid container, or anywhere in between) can't re-run tap-anchor logic
  // and clobber the range the drag just committed. Reset at the START of the
  // next pointerdown too, so it can never linger indefinitely.
  const justDragged = useRef(false)
  // Minimum pointer movement (px) before a press-and-move is treated as a
  // drag rather than a plain click. Keeps an ordinary click from ever being
  // misread as a zero-distance "drag".
  const DRAG_THRESHOLD = 4
  const startX = useRef(0)
  const startY = useRef(0)

  const onRangeSelectedRef = useRef(onRangeSelected)
  onRangeSelectedRef.current = onRangeSelected

  const commitIfMoved = useCallback((): void => {
    if (dragMoved.current && dragStartVerse.current !== null && dragCurrentVerse.current !== null) {
      onRangeSelectedRef.current(dragStartVerse.current, dragCurrentVerse.current)
    }
  }, [])

  const endDrag = useCallback(() => {
    // Commit the final range from pointerup itself — not just from
    // pointerenter — so a fast drag that outruns enter events on intermediate
    // rows still lands on the correct final verse.
    commitIfMoved()
    justDragged.current = dragMoved.current
    dragStartVerse.current = null
    dragCurrentVerse.current = null
    dragMoved.current = false
    setIsDragging(false)
    document.body.style.userSelect = ''
  }, [commitIfMoved])

  useEffect(() => {
    if (!isDragging) return
    const handleUp = (): void => endDrag()
    const handleMove = (e: PointerEvent): void => {
      if (!dragMoved.current) {
        const dx = e.clientX - startX.current
        const dy = e.clientY - startY.current
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) dragMoved.current = true
      }
    }
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    window.addEventListener('pointermove', handleMove)
    return () => {
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      window.removeEventListener('pointermove', handleMove)
    }
  }, [isDragging, endDrag])

  // Call from the row's onClick before running tap-anchor logic; returns true
  // (and clears the flag) exactly once per completed drag.
  const suppressNextClick = useCallback((): boolean => {
    if (justDragged.current) {
      justDragged.current = false
      return true
    }
    return false
  }, [])

  const gutterPointerDown = useCallback(
    (verse: number) => (e: React.PointerEvent) => {
      // Only mouse/pen initiate drag-select; touch keeps the tap gesture
      // (handled directly by the row's existing onClick).
      if (e.pointerType === 'touch') return
      // Guard against starting a drag on interactive elements nested in the row
      // (note pills, buttons) — those should get their own click handling.
      const target = e.target as HTMLElement
      if (target.closest('button, a, [data-no-drag]')) return
      // A fresh press always clears any stale suppression flag from a prior
      // interaction — it must never leak across gestures.
      justDragged.current = false
      dragStartVerse.current = verse
      dragCurrentVerse.current = verse
      dragMoved.current = false
      startX.current = e.clientX
      startY.current = e.clientY
      setIsDragging(true)
      document.body.style.userSelect = 'none'
    },
    []
  )

  const rowPointerEnter = useCallback(
    (verse: number) => () => {
      if (dragStartVerse.current === null) return
      if (dragCurrentVerse.current !== verse) {
        dragMoved.current = true
        dragCurrentVerse.current = verse
        onRangeSelectedRef.current(dragStartVerse.current, verse)
      }
    },
    []
  )

  return { isDragging, gutterPointerDown, rowPointerEnter, suppressNextClick }
}
