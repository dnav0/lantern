// Builds the self-hosted BSB fallback bundle: public/bible/bsb.json.gz
//
// This is the offline safety net for the scripture read path. helloao
// (bible.helloao.org) is the PRIMARY provider; if it is ever down, the app
// falls back to this bundle so a reader can still open any of the 1,189
// chapters. See src/bible/self-hosted.ts for the runtime side.
//
// Source: https://bereanbible.com/bsb.txt — the publisher's own tab-delimited
// export of the whole Bible, one verse per line ("Book C:V<TAB>text"). We
// deliberately do NOT reconstruct the text by scraping helloao 1,189 times:
// that hammers a free service, and the publisher already offers the complete
// text as a single download.
//
// Licensing: the Berean Standard Bible is dedicated to the public domain (CC0)
// — berean.bible/licensing.htm, since 2023-04-30 — so bundling and
// redistributing the text here is permitted.
//
// Output shape (compact, gzip-compressed JSON):
//   { "<bookNumber>": { "<chapter>": [[verse, text], ...] } }
// bookNumber is the USFM 1–66 index this repo uses everywhere (Genesis = 1).
// Verses are stored as [number, text] pairs rather than a bare string array so
// that omitted textual-variant verses (e.g. Matthew 17:21, which the BSB leaves
// empty) can be dropped without shifting the numbering — the resulting gaps
// match what helloao returns.
//
// Regenerate: node scripts/build-bsb-bundle.mjs
// Offline (reuse a already-downloaded copy): BSB_TXT_PATH=/tmp/bsb.txt node scripts/build-bsb-bundle.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_URL = 'https://bereanbible.com/bsb.txt'
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '..', 'public', 'bible', 'bsb.json.gz')

// Canonical Protestant order, using the exact book names bereanbible.com prints
// in bsb.txt. Note "Psalm" (singular) and "Song of Solomon" — these differ from
// some other tables, so the map is derived from the source's own spelling.
const BOOK_NAMES = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalm', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew',
  'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter',
  '2 Peter', '1 John', '2 John', '3 John', 'Jude',
  'Revelation'
]

const NUMBER_BY_NAME = new Map(BOOK_NAMES.map((name, i) => [name, i + 1]))

// Each verse line is "<Book> <chapter>:<verse><TAB><text>". Book names contain
// spaces ("1 Samuel", "Song of Solomon"), so anchor on the trailing "N:M".
const VERSE_LINE = /^(.+) (\d+):(\d+)$/

async function loadSource() {
  const localPath = process.env.BSB_TXT_PATH
  if (localPath) {
    console.error(`Reading BSB text from ${localPath}`)
    return readFileSync(localPath, 'utf8')
  }
  console.error(`Downloading BSB text from ${SOURCE_URL}`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`)
  return await res.text()
}

const text = await loadSource()

const bundle = {}
let verseCount = 0
let skippedEmpty = 0
const seenBooks = new Set()

for (const rawLine of text.split(/\r?\n/)) {
  const tab = rawLine.indexOf('\t')
  if (tab === -1) continue
  const ref = rawLine.slice(0, tab).trim()
  const verseText = rawLine.slice(tab + 1).trim()

  const m = VERSE_LINE.exec(ref)
  if (!m) continue // header rows ("Verse", copyright) and anything unparseable

  const bookNumber = NUMBER_BY_NAME.get(m[1])
  if (bookNumber === undefined) {
    throw new Error(`Unrecognized book name in source: "${m[1]}" (line: ${ref})`)
  }
  // BSB leaves textual-variant verses (e.g. Matthew 17:21) empty. helloao omits
  // them from the chapter entirely, so we drop them too — the numbering gap is
  // intentional and identical to the primary provider's output.
  if (!verseText) {
    skippedEmpty++
    continue
  }

  const chapter = Number(m[2])
  const verse = Number(m[3])
  seenBooks.add(bookNumber)
  const book = (bundle[bookNumber] ??= {})
  const chapterVerses = (book[chapter] ??= [])
  chapterVerses.push([verse, verseText])
  verseCount++
}

if (seenBooks.size !== 66) {
  throw new Error(`Expected 66 books, parsed ${seenBooks.size}`)
}

const chapterCount = Object.values(bundle).reduce(
  (sum, book) => sum + Object.keys(book).length,
  0
)

const json = JSON.stringify(bundle)
const gz = gzipSync(json, { level: 9 })

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, gz)

console.error(
  `Wrote ${OUT_PATH}\n` +
    `  books:    ${seenBooks.size}\n` +
    `  chapters: ${chapterCount}\n` +
    `  verses:   ${verseCount} (skipped ${skippedEmpty} empty textual-variant verses)\n` +
    `  json:     ${json.length} bytes\n` +
    `  gzip:     ${gz.length} bytes (${(gz.length / 1024).toFixed(0)} KB)`
)
