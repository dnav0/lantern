import { describe, it, expect } from 'vitest'
import { CodedError, toTelemetrySafe } from './errors'
import { HelloaoBibleProvider } from './bible/helloao'
import { SelfHostedBibleProvider } from './bible/self-hosted'

// The canonical leak: a passage reference is what the person was reading. If any
// of these strings can be found anywhere in a serialized telemetry-safe object,
// the structural guarantee in errors.ts has been broken.
const PASSAGE_MARKERS = ['JHN', 'John', 'Genesis', 'GEN', ' 3', 'chapter']

function assertNoPassageLeak(value: unknown, markers = PASSAGE_MARKERS) {
  const serialized = JSON.stringify(value) ?? ''
  for (const marker of markers) {
    expect(serialized).not.toContain(marker)
  }
}

describe('CodedError', () => {
  it('uses the code as the message, so generic .message readers cannot leak', () => {
    const err = new CodedError('BIBLE_FETCH_FAILED', '404 Not Found (JHN 3)')
    expect(err.message).toBe('BIBLE_FETCH_FAILED')
    expect(err.code).toBe('BIBLE_FETCH_FAILED')
  })

  it('keeps the detail reachable for the console', () => {
    const err = new CodedError('BIBLE_FETCH_FAILED', '404 Not Found (JHN 3)')
    expect(err.detailForConsole()).toBe('404 Not Found (JHN 3)')
  })

  it('hides the detail from every generic serialization mechanism', () => {
    const err = new CodedError('BIBLE_FETCH_FAILED', '404 Not Found (JHN 3)')

    // This is the point of the #private field: none of the things a payload
    // builder would plausibly reach for can see the detail.
    assertNoPassageLeak({ ...err })
    assertNoPassageLeak(err)
    expect(Object.keys(err)).not.toContain('detail')
    expect(
      Object.entries(err)
        .map(([, v]) => String(v))
        .join(' ')
    ).not.toContain('JHN')
    expect((err as unknown as Record<string, unknown>)['detail']).toBeUndefined()
    expect(String(err)).not.toContain('JHN')
  })
})

describe('toTelemetrySafe', () => {
  it('carries the code, class and frames, and nothing else', () => {
    const err = new CodedError('BIBLE_FETCH_FAILED', '404 Not Found (JHN 3)')
    const safe = toTelemetrySafe(err)

    expect(safe.code).toBe('BIBLE_FETCH_FAILED')
    expect(safe.errorClass).toBe('CodedError')
    expect(Object.keys(safe).sort()).toEqual(['code', 'errorClass', 'stack'])
    assertNoPassageLeak(safe)
  })

  it('strips the "Name: message" header from the stack', () => {
    // The stack is the field that could smuggle a message back in after we
    // refused to read .message directly.
    const err = new Error('reading Genesis 1 failed')
    const safe = toTelemetrySafe(err)
    expect(safe.stack ?? '').not.toContain('Genesis')
    // ...but real frames survive, or the field would be useless.
    expect(safe.stack ?? '').toMatch(/at\s|@.+:\d+:\d+/)
  })

  it('strips a MULTI-LINE message header, not just the first line', () => {
    // A drop-the-first-line rule would leak here. Positive frame matching does
    // not, which is why framesOnly() is written the way it is.
    const err = new Error('line one\nline two mentions John 3\nline three')
    const safe = toTelemetrySafe(err)
    assertNoPassageLeak(safe)
  })

  it('gives a foreign error no message at all, only class and frames', () => {
    // Foreign errors (Supabase, DOM, libraries) are written by people who never
    // heard of this rule, and Postgres echoes submitted values into constraint
    // messages. So their message is never read.
    const err = new TypeError('value "John 3:16 is my favorite" violates something')
    const safe = toTelemetrySafe(err)
    expect(safe.code).toBe('UNKNOWN_ERROR')
    expect(safe.errorClass).toBe('TypeError')
    assertNoPassageLeak(safe)
  })

  it('handles non-Error throws without leaking them', () => {
    const safe = toTelemetrySafe('John 3 blew up')
    expect(safe.code).toBe('UNKNOWN_ERROR')
    expect(safe.errorClass).toBe('string')
    expect(safe.stack).toBeUndefined()
    assertNoPassageLeak(safe)
  })
})

// End-to-end over the REAL throw sites, driven the way they actually fail. This
// is the test that would have caught the original bug, because it does not
// depend on anyone remembering to check a particular message string.
describe('real scripture-path failures are content-free once made safe', () => {
  it('helloao 404 (the canonical leak) reports no passage', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response('nope', { status: 404, statusText: 'Not Found' })) as typeof fetch
    try {
      const err = await new HelloaoBibleProvider()
        .getChapter(43, 3) // John 3 — the exact example in TELEMETRY.md
        .then(() => null)
        .catch((e: unknown) => e)

      expect((err as CodedError).code).toBe('BIBLE_FETCH_FAILED')
      // The detail still has it, locally, for the console.
      expect((err as CodedError).detailForConsole()).toContain('JHN 3')
      // The reportable form does not.
      assertNoPassageLeak(toTelemetrySafe(err))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('a self-hosted bundle miss reports no passage', async () => {
    const empty = {} as Record<string, Record<string, [number, string][]>>
    const err = await new SelfHostedBibleProvider('/unused', async () => empty)
      .getChapter(43, 3)
      .then(() => null)
      .catch((e: unknown) => e)

    expect((err as CodedError).code).toBe('BIBLE_BUNDLE_CHAPTER_MISSING')
    assertNoPassageLeak(toTelemetrySafe(err))
  })

  it('an unknown book number reports no book number', async () => {
    const err = await new HelloaoBibleProvider()
      .getChapter(999, 1)
      .then(() => null)
      .catch((e: unknown) => e)

    expect((err as CodedError).code).toBe('BIBLE_UNKNOWN_BOOK')
    assertNoPassageLeak(toTelemetrySafe(err), ['999'])
  })
})
