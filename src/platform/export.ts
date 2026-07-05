// platform/export.ts — "Export all notes" as a zip of per-passage Markdown
// files, matching the legacy Electron vault format exactly (see
// `git show legacy/electron:src/main/db/vault.ts`). This is a `platform/`
// module because a future Capacitor/Tauri wrapper would reimplement the
// "save this zip somewhere" step natively; the serialization itself is pure
// and portable.

import { zipSync, strToU8 } from 'fflate'
import type { BereanApi } from '../api/types'
import type { Note, Passage } from '../types'
import { bookByNumber } from '../utils/bibleBooks'

// Make a string safe for use as a filename on macOS, Windows, and Linux.
// Mirrors legacy vault.ts's safeFilename exactly.
export function safeFilename(s: string): string {
  return s
    .replace(/:/g, '.') // "Romans 8:1-11" -> "Romans 8.1-11"
    .replace(/[\\/?*"|<>]/g, '')
    .trim()
}

// Serialize one passage's notes into the legacy vault Markdown format:
//   ---
//   reference: ...
//   book: ...
//   chapter_start / verse_start / chapter_end / verse_end: ...
//   updated: <ISO>
//   ---
//   (blank line)
//   - {content}
//   - {content}
//   (trailing blank line)
// Notes are ordered by anchor_start_verse ascending (nulls last), then by
// created_at, matching the legacy SQL `ORDER BY anchor_start_verse NULLS LAST, created_at`.
export function serializePassageMarkdown(passage: Passage, bookName: string, notes: Note[]): string {
  const ordered = [...notes].sort((a, b) => {
    const av = a.anchor_start_verse
    const bv = b.anchor_start_verse
    if (av === null && bv === null) return a.created_at.localeCompare(b.created_at)
    if (av === null) return 1
    if (bv === null) return -1
    if (av !== bv) return av - bv
    return a.created_at.localeCompare(b.created_at)
  })

  const lines = [
    '---',
    `reference: ${passage.reference_label}`,
    `book: ${bookName}`,
    `chapter_start: ${passage.chapter_start}`,
    `verse_start: ${passage.verse_start}`,
    `chapter_end: ${passage.chapter_end}`,
    `verse_end: ${passage.verse_end}`,
    `updated: ${new Date().toISOString()}`,
    '---',
    '',
    ...ordered.map(n => `- ${n.content}`),
    ''
  ]
  return lines.join('\n')
}

export interface ExportResult {
  passageCount: number
  fileCount: number
}

// Build the zip in memory: notes/{BookName}/{safeFilename(reference_label)}.md
// per passage, and trigger a browser download via blob + anchor.
export async function exportAllNotesAsZip(api: BereanApi): Promise<ExportResult> {
  const passages = await api.getPassages()
  const files: Record<string, Uint8Array> = {}

  for (const passage of passages) {
    const notes = await api.getNotesByPassage(passage.id)
    const book = bookByNumber(passage.book_number)
    const bookName = book?.name ?? `Book ${passage.book_number}`
    const md = serializePassageMarkdown(passage, bookName, notes)
    const path = `notes/${bookName}/${safeFilename(passage.reference_label)}.md`
    files[path] = strToU8(md)
  }

  const zipped = zipSync(files, { level: 6 })
  const blob = new Blob([zipped], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `berean-notes-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return { passageCount: passages.length, fileCount: Object.keys(files).length }
}
