import { describe, it, expect } from 'vitest'
import { shouldStartMarquee } from './useVerseMarquee'

// A plain primary-button mouse press over verse text — the baseline that SHOULD
// begin a marquee. Each test overrides exactly one field so the branch under
// test is unambiguous.
const base = {
  pointerType: 'mouse',
  button: 0,
  altKey: false,
  onInteractiveTarget: false
}

describe('shouldStartMarquee — Alt copy escape hatch', () => {
  it('starts a marquee on a plain primary press (altKey false)', () => {
    expect(shouldStartMarquee({ ...base, altKey: false })).toBe(true)
  })

  it('suppresses the marquee when Alt is held at pointerdown (altKey true)', () => {
    expect(shouldStartMarquee({ ...base, altKey: true })).toBe(false)
  })

  it('Alt suppresses even over plain verse text, not just interactive targets', () => {
    expect(shouldStartMarquee({ ...base, altKey: true, onInteractiveTarget: false })).toBe(false)
  })
})

describe('shouldStartMarquee — existing guards are unchanged', () => {
  it('never starts on touch (the tap-anchor gesture keeps the row)', () => {
    expect(shouldStartMarquee({ ...base, pointerType: 'touch' })).toBe(false)
  })

  it('only a primary button starts a marquee', () => {
    expect(shouldStartMarquee({ ...base, button: 2 })).toBe(false)
    expect(shouldStartMarquee({ ...base, button: 1 })).toBe(false)
  })

  it('never starts on an interactive child / note surface', () => {
    expect(shouldStartMarquee({ ...base, onInteractiveTarget: true })).toBe(false)
  })
})
