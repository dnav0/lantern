import { describe, it, expect, vi } from 'vitest'
import { SelfHostedBibleProvider } from './self-hosted'
import { CodedError } from '../errors'

// A minimal in-memory bundle in the on-disk shape:
//   { "<bookNumber>": { "<chapter>": [[verse, text], ...] } }
const BUNDLE = {
  '43': {
    '1': [
      [1, 'In the beginning was the Word'],
      [2, 'He was with God in the beginning']
    ]
  },
  '40': {
    // Matthew 17 with the omitted textual-variant verse 21 left out, exactly as
    // the build script produces it — the numbering gap is intentional.
    '17': [
      [20, 'you will say to this mountain'],
      [22, 'The Son of Man is about to be delivered']
    ]
  }
} as unknown as Record<string, Record<string, [number, string][]>>

describe('SelfHostedBibleProvider', () => {
  it('serves any chapter present in the bundle, mapped to BibleVerseLine[]', async () => {
    const p = new SelfHostedBibleProvider('/unused', async () => BUNDLE)
    await expect(p.getChapter(43, 1)).resolves.toEqual([
      { verse: 1, text: 'In the beginning was the Word' },
      { verse: 2, text: 'He was with God in the beginning' }
    ])
  })

  it('preserves intentional verse-number gaps (omitted variant verses)', async () => {
    const p = new SelfHostedBibleProvider('/unused', async () => BUNDLE)
    const verses = await p.getChapter(40, 17)
    expect(verses.map(v => v.verse)).toEqual([20, 22])
  })

  it('throws a coded error for a chapter the bundle does not contain', async () => {
    const p = new SelfHostedBibleProvider('/unused', async () => BUNDLE)
    await expect(p.getChapter(66, 23)).rejects.toThrow(CodedError)
    // The passage lives in the detail, never in the message. Asserted here and
    // not only in errors.test.ts because this is the throw site that would
    // regress if someone "helpfully" put the book back in the message.
    const err = (await p
      .getChapter(66, 23)
      .then(() => null)
      .catch((e: unknown) => e)) as CodedError
    expect(err.code).toBe('BIBLE_BUNDLE_CHAPTER_MISSING')
    expect(err.message).toBe('BIBLE_BUNDLE_CHAPTER_MISSING')
    expect(err.detailForConsole()).toContain('no book 66 chapter 23')
  })

  it('loads the bundle lazily and only once, sharing it across reads', async () => {
    const loader = vi.fn(async () => BUNDLE)
    const p = new SelfHostedBibleProvider('/unused', loader)

    // Constructing the provider must NOT load anything — this is what keeps a
    // normal, successful read from ever downloading the 1.2 MB bundle.
    expect(loader).not.toHaveBeenCalled()

    await Promise.all([p.getChapter(43, 1), p.getChapter(40, 17), p.getChapter(43, 1)])
    expect(loader).toHaveBeenCalledTimes(1)
  })
})
