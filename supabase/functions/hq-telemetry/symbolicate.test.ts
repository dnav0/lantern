import { describe, it, expect } from 'vitest'
import { build } from 'esbuild'
import { createSymbolicator } from './symbolicate'

// The decoder in symbolicate.ts is hand-written Base64-VLQ, so it is tested
// against a REAL source map produced by a real bundler rather than a synthetic
// one. A hand-built fixture would only prove the decoder agrees with whatever
// the fixture's author believed the format to be, which is exactly the mistake
// worth catching here: the running totals for source index / line / column
// carry ACROSS generated lines while the generated column resets per line, and
// getting that wrong yields plausible-looking, confidently wrong line numbers.
//
// esbuild is already a vite dependency, so this adds nothing to package.json.

const ORIGINAL = `export function alpha(n) {
  if (n < 0) {
    throw new Error('negative')
  }
  return n * 2
}

export function beta(n) {
  return alpha(n) + 1
}
`

async function bundle(): Promise<{ code: string; map: string }> {
  const result = await build({
    stdin: {
      contents: ORIGINAL,
      sourcefile: 'original.js',
      loader: 'js',
      resolveDir: process.cwd()
    },
    bundle: true,
    minify: true,
    format: 'esm',
    sourcemap: 'external',
    write: false,
    outfile: 'out.js'
  })
  const map = result.outputFiles.find(f => f.path.endsWith('.map'))!.text
  const code = result.outputFiles.find(f => !f.path.endsWith('.map'))!.text
  return { code, map }
}

describe('symbolicate', () => {
  it('maps a minified frame back to the original file and line', async () => {
    const { code, map } = await bundle()

    // Locate a real position in the minified output: the "negative" literal,
    // which lives on line 3 of the original (1-based).
    const idx = code.indexOf('negative')
    expect(idx).toBeGreaterThan(-1)
    const before = code.slice(0, idx)
    const genLine = before.split('\n').length
    const genCol = idx - (before.lastIndexOf('\n') + 1) + 1 // 1-based, like a stack

    const sym = createSymbolicator(async () => map)
    const out = await sym.symbolicate(
      `at x (https://lanternword.com/assets/out.js:${genLine}:${genCol})`,
      'deadbeef'
    )

    expect(out).toContain('original.js')
    // Line 3 is `throw new Error('negative')`.
    expect(out).toMatch(/original\.js:3:/)
  })

  it('returns the frame unchanged when there is no commit sha', async () => {
    // Without a commit we cannot pick the right map, and mapping against the
    // wrong build is worse than not mapping — the output looks authoritative.
    const sym = createSymbolicator(async () => {
      throw new Error('should not be called')
    })
    const frame = 'at x (https://lanternword.com/assets/out.js:1:20)'
    expect(await sym.symbolicate(frame, null)).toBe(frame)
  })

  it('returns the frame unchanged when the map is missing', async () => {
    const sym = createSymbolicator(async () => null)
    const frame = 'at x (https://lanternword.com/assets/out.js:1:20)'
    expect(await sym.symbolicate(frame, 'deadbeef')).toBe(frame)
  })

  it('returns the frame unchanged when the map is malformed', async () => {
    const sym = createSymbolicator(async () => 'not json at all')
    const frame = 'at x (https://lanternword.com/assets/out.js:1:20)'
    expect(await sym.symbolicate(frame, 'deadbeef')).toBe(frame)
  })

  it('survives a storage failure without throwing', async () => {
    // Symbolication is best effort. A storage outage must degrade to raw
    // frames, never to a 500 on the telemetry endpoint.
    const sym = createSymbolicator(async () => {
      throw new Error('storage down')
    })
    const frame = 'at x (https://lanternword.com/assets/out.js:1:20)'
    await expect(sym.symbolicate(frame, 'deadbeef')).resolves.toBe(frame)
  })

  it('downloads each map once per request even across many frames', async () => {
    const { map } = await bundle()
    let calls = 0
    const sym = createSymbolicator(async () => {
      calls += 1
      return map
    })
    const stack = Array.from(
      { length: 20 },
      () => 'at x (https://lanternword.com/assets/out.js:1:20)'
    ).join('\n')
    await sym.symbolicate(stack, 'deadbeef')
    expect(calls).toBe(1)
  })

  it('leaves non-frame lines alone', async () => {
    const sym = createSymbolicator(async () => null)
    expect(await sym.symbolicate('something else entirely', 'deadbeef')).toBe(
      'something else entirely'
    )
  })
})
