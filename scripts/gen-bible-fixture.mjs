// Generates src/bible/fixture.ts from the live helloao API, reusing the exact
// flatten logic in src/bible/helloao.ts so the offline text matches the network
// text byte-for-byte.
import { writeFileSync } from 'node:fs'

const BASE_URL = 'https://bible.helloao.org/api/BSB'

// (bookNumber, usfm, chapter) for the chapters seedMemoryApi references.
const WANTED = [
  [1, 'GEN', 1],
  [19, 'PSA', 23],
  [43, 'JHN', 1],
  [45, 'ROM', 8]
]

function flattenVerseContent(content) {
  const parts = []
  for (const item of content) {
    if (typeof item === 'string') parts.push(item)
    else if ('text' in item) parts.push(item.text)
  }
  return parts
    .join(' ')
    .replace(/\s+([,.;:!?”’])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const chapters = []
for (const [bookNumber, usfm, chapter] of WANTED) {
  const res = await fetch(`${BASE_URL}/${usfm}/${chapter}.json`)
  if (!res.ok) throw new Error(`fetch failed ${usfm} ${chapter}: ${res.status}`)
  const data = await res.json()
  const verses = []
  for (const node of data.chapter.content) {
    if (node.type !== 'verse' || node.number === undefined || !node.content) continue
    verses.push({ verse: node.number, text: flattenVerseContent(node.content) })
  }
  chapters.push({ bookNumber, chapter, verses })
  console.error(`${usfm} ${chapter}: ${verses.length} verses`)
}

const body = chapters
  .map(
    c =>
      `  '${c.bookNumber}/${c.chapter}': [\n` +
      c.verses
        .map(v => `    { verse: ${v.verse}, text: ${JSON.stringify(v.text)} }`)
        .join(',\n') +
      '\n  ]'
  )
  .join(',\n')

const out = `import type { BibleProvider, BibleVerseLine } from './provider'

// Offline BSB text for the handful of chapters seedMemoryApi references, so a
// dev or an agent with no network still sees real scripture instead of a thrown
// fetch. Generated from bible.helloao.org with the same flatten logic as
// helloao.ts, so the text matches the network response exactly.
//
// This is a DEV-ONLY stopgap, wired in service.ts behind import.meta.env.DEV and
// tree-shaken out of production. The real answer for offline readers is the
// full-BSB prefetch (docs/BACKLOG.md) — four chapters is a fixture, not a Bible.
//
// Regenerate: node scripts/gen-bible-fixture.mjs > src/bible/fixture.ts

const CHAPTERS: Record<string, BibleVerseLine[]> = {
${body}
}

export class FixtureBibleProvider implements BibleProvider {
  async getChapter(bookNumber: number, chapter: number): Promise<BibleVerseLine[]> {
    const verses = CHAPTERS[\`\${bookNumber}/\${chapter}\`]
    if (!verses) {
      throw new Error(
        \`No offline fixture for book \${bookNumber} chapter \${chapter}. \` +
          'Only the seeded chapters are bundled — see src/bible/fixture.ts.'
      )
    }
    return verses
  }
}
`

writeFileSync(process.argv[2], out)
console.error(`wrote ${process.argv[2]} (${out.length} bytes)`)
