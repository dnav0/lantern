import { useEffect, useRef } from 'react'

// Shared machinery for the landing's looping animation clips.
//
// The design specs (design/lantern-hero.html, design/lantern-features.html) are
// written as `while (true)` async scripts that drive the DOM imperatively —
// toggling classes, measuring positions, sequencing dozens of steps with sleeps.
// They are ported as-is rather than re-expressed in React state: the sequences
// are the approved spec, and the hero's loop in particular depends on exact
// measured layout (see design/README.md — do not "simplify" it).
//
// What this adds over the spec's raw script:
//   - cancellation, so a loop cannot outlive its component or stack up on
//     re-render. `wait()` rejects with Cancelled once stopped, which unwinds the
//     `while (true)` body wherever it happens to be sitting.
//   - visibility gating, so offscreen clips are not burning frames. A landing
//     page with four independent loops running at all times is the difference
//     between a calm page and a hot laptop.

class Cancelled extends Error {}

export interface Loop {
  /** Sleep, unless the loop has been cancelled — then unwind out of the script. */
  wait: (ms: number) => Promise<void>
}

type Script = (loop: Loop) => Promise<void>

function createLoop(): { loop: Loop; cancel: () => void } {
  let stopped = false
  const pending = new Set<{ id: number; reject: (e: Cancelled) => void }>()

  const wait = (ms: number): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (stopped) {
        reject(new Cancelled())
        return
      }
      const entry = { id: 0, reject }
      entry.id = window.setTimeout(() => {
        pending.delete(entry)
        if (stopped) reject(new Cancelled())
        else resolve()
      }, ms)
      pending.add(entry)
    })

  const cancel = (): void => {
    stopped = true
    for (const entry of pending) {
      clearTimeout(entry.id)
      entry.reject(new Cancelled())
    }
    pending.clear()
  }

  return { loop: { wait }, cancel }
}

/**
 * Run `script` as a looping clip inside `ref`'s element, while it is on screen.
 *
 * The script starts when the element first scrolls into view and is cancelled
 * when it leaves, restarting from the top on re-entry — a clip the user scrolls
 * back to should be showing its opening, not whatever frame it was paused on.
 *
 * Under `prefers-reduced-motion: reduce` the script never runs at all; each clip
 * renders its own resting state instead (the specs define one per clip).
 */
export function useClipLoop(
  ref: React.RefObject<HTMLElement>,
  script: Script,
  reducedMotion: boolean
): void {
  // Keep the latest script without making it an effect dependency — the scripts
  // close over refs, not props, so re-running the effect would only restart the
  // animation for no reason.
  const scriptRef = useRef(script)
  scriptRef.current = script

  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion) return

    let active: { cancel: () => void } | null = null

    const start = (): void => {
      if (active) return
      const { loop, cancel } = createLoop()
      active = { cancel }
      scriptRef.current(loop).catch(err => {
        // A cancelled loop is the normal exit path, not a failure.
        if (!(err instanceof Cancelled)) throw err
      })
    }

    const stop = (): void => {
      active?.cancel()
      active = null
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) start()
          else stop()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      stop()
    }
  }, [ref, reducedMotion])
}

/** Matches `prefers-reduced-motion: reduce` at mount. */
export function usePrefersReducedMotion(): boolean {
  const ref = useRef<boolean | null>(null)
  if (ref.current === null) {
    ref.current =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return ref.current
}
