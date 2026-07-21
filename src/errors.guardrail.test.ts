import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Makes the discipline in errors.ts self-enforcing instead of remembered.
//
// A convention cannot reach forwards any better than it reaches backwards (see
// errors.ts's own header on that). The six sites that interpolated a passage
// reference into a thrown message were converted to CodedError by hand, and an
// earlier audit missed one of them (src/bible/fixture.ts) doing exactly that
// review-by-eye. This test scans the tree itself so the next interpolated
// `throw new Error(` fails the build instead of shipping quietly.
//
// Deliberately narrow: it only flags `throw new Error(` (never CodedError, never
// other Error subclasses) called with a template literal. That is the exact
// shape of the original bug — a native Error's message is the only thing a
// generic handler (window.onerror, an error boundary) can read.

const SRC_ROOT = join(__dirname, '.')

// Matches `throw new Error(` followed, after only whitespace/comments-free gap,
// by a template literal opening backtick. Spans newlines so a wrapped call like
// `throw new Error(\n  \`...\`\n)` is still caught.
const INTERPOLATED_THROW = /throw\s+new\s+Error\s*\(\s*`/g

function isTestFile(fileName: string): boolean {
  return /\.test\.tsx?$/.test(fileName)
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
    } else if (/\.tsx?$/.test(entry) && !isTestFile(entry)) {
      files.push(fullPath)
    }
  }
  return files
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

interface Violation {
  file: string
  line: number
}

function findInterpolatedThrows(files: string[]): Violation[] {
  const violations: Violation[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const match of content.matchAll(INTERPOLATED_THROW)) {
      violations.push({
        file: relative(SRC_ROOT, file).replace(/\\/g, '/'),
        line: lineNumberAt(content, match.index ?? 0)
      })
    }
  }
  return violations
}

describe('no interpolated throw new Error(...)', () => {
  it('never uses a template literal in a native `throw new Error(...)` — use CodedError instead', () => {
    const files = collectSourceFiles(SRC_ROOT)
    const violations = findInterpolatedThrows(files)
    const report = violations.map(v => `  ${v.file}:${v.line}`).join('\n')

    expect(
      violations,
      `Found ${violations.length} interpolated \`throw new Error(...)\` call(s). ` +
        `A template literal here can smuggle user content (e.g. a passage reference) ` +
        `into a native Error's message, which is content telemetry can read. ` +
        `Use CodedError instead (see src/errors.ts):\n${report}`
    ).toEqual([])
  })
})
