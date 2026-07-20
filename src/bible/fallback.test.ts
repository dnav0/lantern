import { describe, it, expect, vi, afterEach } from 'vitest'
import type { BibleProvider, BibleVerseLine } from './provider'
import { FallbackBibleProvider } from './fallback'
import { SelfHostedBibleProvider } from './self-hosted'

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

// This is the production wiring: helloao PRIMARY, the self-hosted complete BSB
// as the FALLBACK. Unlike the four-chapter dev fixture, the self-hosted provider
// can serve any of the 1,189 chapters, so a helloao outage never takes the read
// path down.
describe('FallbackBibleProvider with the self-hosted BSB', () => {
  const BUNDLE = {
    '43': { '3': [[16, 'For God so loved the world']] }
  } as unknown as Record<string, Record<string, [number, string][]>>

  it('never touches the self-hosted bundle when helloao succeeds', async () => {
    const loader = vi.fn(async () => BUNDLE)
    const p = new FallbackBibleProvider(
      provider(async () => VERSES),
      new SelfHostedBibleProvider('/unused', loader)
    )
    await expect(p.getChapter(43, 3)).resolves.toEqual(VERSES)
    expect(loader).not.toHaveBeenCalled()
  })

  it('serves real BSB from the self-hosted bundle when helloao fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = new FallbackBibleProvider(
      provider(async () => {
        throw new Error('helloao fetch failed: 503')
      }),
      new SelfHostedBibleProvider('/unused', async () => BUNDLE)
    )
    await expect(p.getChapter(43, 3)).resolves.toEqual([
      { verse: 16, text: 'For God so loved the world' }
    ])
  })

  it('rethrows the helloao error, not the self-hosted miss, when both fail', async () => {
    const p = new FallbackBibleProvider(
      provider(async () => {
        throw new Error('helloao fetch failed: 503')
      }),
      new SelfHostedBibleProvider('/unused', async () => BUNDLE)
    )
    // Book 1 chapter 1 is not in this test bundle, so the fallback misses too.
    await expect(p.getChapter(1, 1)).rejects.toThrow('helloao fetch failed: 503')
  })
})
