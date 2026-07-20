import type { BiblePassage } from '../types'
import type { BibleProvider } from './provider'
import { findBookByAlias, normalizeReference } from '../utils/bibleBooks'
import { HelloaoBibleProvider } from './helloao'
import { CachedBibleProvider } from './cache'
import { FallbackBibleProvider } from './fallback'
import { FixtureBibleProvider } from './fixture'

// The reference-based lookup components already depend on
// (`api.getBibleVerse(reference) -> BiblePassage | null`). This module owns
// that behavior on top of the BibleProvider seam, so both the memory stub and
// SupabaseBereanApi can delegate to a single implementation instead of each
// re-implementing scripture lookup. See CLAUDE.md "BibleProvider" section.
const network: BibleProvider = new CachedBibleProvider(new HelloaoBibleProvider())

// In dev, fall back to bundled BSB text when the network is unreachable, so a
// contributor (or an agent in a sandbox with no egress) still gets real verses
// instead of a thrown fetch. The fixture only covers the chapters seedMemoryApi
// references — it is a stopgap for the seeded demo, not offline reading.
// `import.meta.env.DEV` is statically false in a production build, so the whole
// branch and the ~19KB fixture tree-shake away; real users are unaffected and
// still get a clean failure, which the full-BSB prefetch (docs/BACKLOG.md) is
// the actual answer to.
const provider: BibleProvider = import.meta.env.DEV
  ? new FallbackBibleProvider(network, new FixtureBibleProvider())
  : network

interface ParsedReference {
  bookNumber: number
  chapterStart: number
  verseStart: number
  chapterEnd: number
  verseEnd: number | null // null = "to end of chapter" (chapter-only references)
}

// Parses references in the two shapes call sites produce:
//   "Book ch:v"          "Book ch:v-v"        (StudyMode, NoteEditor, ReadingMode's reference_label)
//   "Book ch"             (BookDetailPage chapter view: no verse component)
// Multi-word book names (e.g. "Song of Solomon", "1 Corinthians") are handled
// by trying progressively shorter prefixes against the alias table, since the
// chapter/verse suffix is unambiguous once matched.
function parseReference(reference: string): ParsedReference | null {
  const ref = normalizeReference(reference)
  // "<chapter>[:<verse>[-<verse>]]" possibly anchored at the end of the string
  const m = /^(.*?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(ref)
  if (!m) return null
  const bookPart = m[1].trim()
  const book = findBookByAlias(bookPart)
  if (!book) return null

  const chapterStart = parseInt(m[2], 10)
  const verseStart = m[3] ? parseInt(m[3], 10) : 1
  const verseEnd = m[4] ? parseInt(m[4], 10) : m[3] ? verseStart : null

  return {
    bookNumber: book.number,
    chapterStart,
    verseStart,
    chapterEnd: chapterStart, // call sites never span chapters today
    verseEnd
  }
}

export async function getBibleVerse(reference: string): Promise<BiblePassage | null> {
  if (!reference.trim()) return null
  const parsed = parseReference(reference)
  if (!parsed) return null

  const chapterVerses = await provider.getChapter(parsed.bookNumber, parsed.chapterStart)
  if (chapterVerses.length === 0) return null

  const verses =
    parsed.verseEnd === null
      ? chapterVerses
      : chapterVerses.filter(v => v.verse >= parsed.verseStart && v.verse <= parsed.verseEnd!)

  if (verses.length === 0) return null

  return {
    reference,
    text: verses.map(v => v.text).join(' '),
    verses
  }
}
