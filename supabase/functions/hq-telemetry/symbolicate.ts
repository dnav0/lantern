// Source-map symbolication, server side.
//
// ─── WHY THIS RUNS HERE AND NOT IN THE BROWSER ───────────────────────────────
//
// HQ's first draft said "symbolicate before sending". Taken literally in the
// browser, that requires publicly fetchable source maps — i.e. publishing the
// app's original source to the entire internet in order to avoid showing stack
// frames to HQ. That is a far larger disclosure than the one it prevents.
//
// The agreed shape instead: the client sends raw minified frames plus a
// commit_sha. This module maps them on the way OUT, using maps held in a
// PRIVATE Supabase Storage bucket and uploaded at build time. HQ receives
// mapped frames and never sees a `.map`; the maps never become public.
//
// ─── WHY THE VLQ DECODER IS WRITTEN OUT HERE ─────────────────────────────────
//
// This deliberately does not pull an npm source-map package. The decoder is
// about forty lines of a stable, well-specified format, and inlining it removes
// a whole class of "does this package work under the edge runtime" failure from
// a function whose entire job is to be boring and always available. If the
// endpoint breaks, nothing in Lantern degrades — but a broken endpoint is
// invisible until someone looks, which is the kind of failure worth designing
// out rather than debugging later.
//
// Symbolication is BEST EFFORT throughout. Every failure path returns the raw
// frame unchanged. A missing map, a malformed map, a storage outage, a frame
// shape we don't recognise: all of them degrade to "you get the minified frame",
// never to an error and never to a dropped event. An unsymbolicated stack is
// mildly annoying; a 500 on the telemetry endpoint is a health alert.

const BUCKET = 'sourcemaps'

interface DecodedMap {
  sources: string[]
  names: string[]
  // Per generated line: segments sorted by generated column.
  lines: Segment[][]
}

interface Segment {
  genCol: number
  srcIndex?: number
  srcLine?: number // 0-based
  srcCol?: number
  nameIndex?: number
}

const B64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_LOOKUP = new Map<string, number>(
  Array.from(B64, (ch, i) => [ch, i] as [string, number])
)

/**
 * Decode one Base64-VLQ run into signed integers.
 *
 * Format: each character carries 5 payload bits plus a continuation bit. The
 * first value's least significant bit is the sign. Values are DELTAS against
 * running totals, which is why the caller keeps state across segments.
 */
function decodeVlq(segment: string): number[] {
  const values: number[] = []
  let shift = 0
  let value = 0
  for (const ch of segment) {
    const digit = B64_LOOKUP.get(ch)
    if (digit === undefined) return values // malformed: keep what we have
    const hasContinuation = (digit & 32) !== 0
    value += (digit & 31) << shift
    if (hasContinuation) {
      shift += 5
    } else {
      const negative = (value & 1) === 1
      value >>= 1
      values.push(negative ? -value : value)
      shift = 0
      value = 0
    }
  }
  return values
}

function decodeMappings(mappings: string): Segment[][] {
  const lines: Segment[][] = []
  // Running totals — every field except the generated column is relative to the
  // previous segment ACROSS lines, not within one. Getting this wrong yields
  // plausible-looking but completely wrong line numbers.
  let srcIndex = 0
  let srcLine = 0
  let srcCol = 0
  let nameIndex = 0

  for (const lineStr of mappings.split(';')) {
    const segments: Segment[] = []
    let genCol = 0 // this one DOES reset per line
    if (lineStr.length > 0) {
      for (const segStr of lineStr.split(',')) {
        if (!segStr) continue
        const fields = decodeVlq(segStr)
        if (fields.length === 0) continue
        genCol += fields[0]
        const seg: Segment = { genCol }
        if (fields.length >= 4) {
          srcIndex += fields[1]
          srcLine += fields[2]
          srcCol += fields[3]
          seg.srcIndex = srcIndex
          seg.srcLine = srcLine
          seg.srcCol = srcCol
          if (fields.length >= 5) {
            nameIndex += fields[4]
            seg.nameIndex = nameIndex
          }
        }
        segments.push(seg)
      }
    }
    segments.sort((a, b) => a.genCol - b.genCol)
    lines.push(segments)
  }
  return lines
}

function parseMap(raw: string): DecodedMap | null {
  try {
    const json = JSON.parse(raw) as {
      sources?: string[]
      names?: string[]
      mappings?: string
    }
    if (!json.mappings) return null
    return {
      sources: json.sources ?? [],
      names: json.names ?? [],
      lines: decodeMappings(json.mappings)
    }
  } catch {
    return null
  }
}

/**
 * Largest segment whose generated column is <= the one we're looking for.
 * Binary search: a minified bundle line can carry tens of thousands of
 * segments, and this runs per frame per event.
 */
function findSegment(segments: Segment[], col: number): Segment | null {
  let lo = 0
  let hi = segments.length - 1
  let best: Segment | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segments[mid].genCol <= col) {
      best = segments[mid]
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

// "    at fnName (https://host/assets/index-abc123.js:1:2345)"
// "    at https://host/assets/index-abc123.js:1:2345"
const FRAME_RE = /^\s*at\s+(?:(.+?)\s+\()?(\S+?):(\d+):(\d+)\)?\s*$/

export interface Symbolicator {
  symbolicate(stack: string, commitSha: string | null): Promise<string>
}

/**
 * @param fetchMap Loads a `.map` by (commitSha, bundleFileName), or null if it
 *                 isn't there. Injected so the whole module is testable without
 *                 Storage, and so the Storage client stays in index.ts.
 */
export function createSymbolicator(
  fetchMap: (commitSha: string, fileName: string) => Promise<string | null>
): Symbolicator {
  // Per-invocation memo. One event's stack has many frames from the same
  // bundle, and a pull returns many events from the same deploy, so without
  // this a single request would re-download and re-decode the same multi-MB map
  // dozens of times.
  const cache = new Map<string, DecodedMap | null>()

  async function mapFor(commitSha: string, fileName: string): Promise<DecodedMap | null> {
    const key = `${commitSha}/${fileName}`
    if (cache.has(key)) return cache.get(key) ?? null
    let decoded: DecodedMap | null = null
    try {
      const raw = await fetchMap(commitSha, fileName)
      decoded = raw ? parseMap(raw) : null
    } catch {
      decoded = null
    }
    cache.set(key, decoded)
    return decoded
  }

  return {
    async symbolicate(stack: string, commitSha: string | null): Promise<string> {
      // No commit means no way to pick the right map, and guessing "the latest"
      // would map frames against the wrong build — worse than not mapping,
      // because the result looks authoritative and is wrong.
      if (!commitSha) return stack

      const out: string[] = []
      for (const line of stack.split('\n')) {
        const m = FRAME_RE.exec(line)
        if (!m) {
          out.push(line)
          continue
        }
        const [, fnName, url, lineNo, colNo] = m
        const fileName = url.split('/').pop() ?? ''
        if (!fileName.endsWith('.js')) {
          out.push(line)
          continue
        }

        const decoded = await mapFor(commitSha, fileName)
        if (!decoded) {
          out.push(line)
          continue
        }

        // Stack traces are 1-based; source maps are 0-based on lines.
        const segments = decoded.lines[Number(lineNo) - 1]
        if (!segments || segments.length === 0) {
          out.push(line)
          continue
        }
        const seg = findSegment(segments, Number(colNo) - 1)
        if (!seg || seg.srcIndex === undefined) {
          out.push(line)
          continue
        }

        const source = decoded.sources[seg.srcIndex] ?? '<unknown>'
        const name =
          (seg.nameIndex !== undefined ? decoded.names[seg.nameIndex] : undefined) ??
          fnName ??
          '<anonymous>'
        out.push(`at ${name} (${source}:${(seg.srcLine ?? 0) + 1}:${(seg.srcCol ?? 0) + 1})`)
      }
      return out.join('\n')
    }
  }
}

export { BUCKET as SOURCEMAP_BUCKET }
