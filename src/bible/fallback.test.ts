import { describe, it, expect, vi, afterEach } from 'vitest'
import type { BibleProvider, BibleVerseLine } from './provider'
import { FallbackBibleProvider } from './fallback'

const VERSES: BibleVerseLine[] = [{ verse: 1, text: 'from the primary' }]
const FIXTURE: BibleVerseLine[] = [{ verse: 1, text: 'from the fixture' }]

function provider(impl: BibleProvider['getChapter']): BibleProvider {
  return { getChapter: impl }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FallbackBibleProvider', () => {
  it('serves the primary and never touches the fallback when the network works', async () => {
    const fallback = vi.fn()
    const p = new FallbackBibleProvider(
      provider(async () => VERSES),
      provider(fallback)
    )
    await expect(p.getChapter(43, 1)).resolves.toEqual(VERSES)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('falls back to the fixture when the primary throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = new FallbackBibleProvider(
      provider(async () => {
        throw new Error('offline')
      }),
      provider(async () => FIXTURE)
    )
    await expect(p.getChapter(43, 1)).resolves.toEqual(FIXTURE)
  })

  it('rethrows the primary error, not the fixture miss, when both fail', async () => {
    // The network failure is the real cause; "no fixture for 40/2" would send a
    // reader chasing the wrong problem.
    const p = new FallbackBibleProvider(
      provider(async () => {
        throw new Error('helloao fetch failed: 503')
      }),
      provider(async () => {
        throw new Error('No offline fixture for book 40 chapter 2')
      })
    )
    await expect(p.getChapter(40, 2)).rejects.toThrow('helloao fetch failed: 503')
  })

  it('passes the book and chapter through to the fallback unchanged', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fallback = vi.fn(async () => FIXTURE)
    const p = new FallbackBibleProvider(
      provider(async () => {
        throw new Error('offline')
      }),
      provider(fallback)
    )
    await p.getChapter(19, 23)
    expect(fallback).toHaveBeenCalledWith(19, 23)
  })
})
