import type {
  Passage,
  JournalEntry,
  Session,
  Note,
  NoteWithPassageInfo,
  NoteSearchResult,
  BiblePassage,
  CreatePassageInput,
  CreateNoteInput,
  UpdateNoteInput,
  DeleteNoteResult
} from '../types'

// BereanApi is the single choke point for all data access and mutation.
// Components consume it via useApi() (src/api/context.tsx) — never a global.
// Evolved from the legacy Electron window.api surface:
//   - integer ids -> UUID strings
//   - book_id / Books-table methods -> book_number on Passage
//   - dropped: vault, updater, translation-settings
// The future offline outbox slots in behind this interface: a failed write is
// caught here and surfaced as a friendly error, which is exactly what the outbox
// later replaces.
export interface BereanApi {
  // Passages
  getPassages(): Promise<Passage[]>
  getPassagesByBook(bookNumber: number): Promise<Passage[]>
  getPassageById(id: string): Promise<Passage | null>
  createPassage(data: CreatePassageInput): Promise<Passage>
  deletePassageAll(passageId: string): Promise<{ deletedPassageId: string }>
  // Journal listing: every studied passage with note count, last activity and a
  // first-note preview, in one call (the Journal page's only read).
  getJournalEntries(): Promise<JournalEntry[]>

  // Sessions
  getSessionsByPassage(passageId: string): Promise<Session[]>
  createSession(passageId: string): Promise<Session>

  // Notes
  getNotesBySession(sessionId: string): Promise<Note[]>
  getNotesByBook(bookNumber: number): Promise<NoteWithPassageInfo[]>
  getNotesByPassage(passageId: string): Promise<Note[]>
  createNote(data: CreateNoteInput): Promise<Note>
  updateNote(id: string, data: UpdateNoteInput): Promise<Note>
  deleteNote(id: string): Promise<void>
  deleteNoteAndCascade(id: string): Promise<DeleteNoteResult>

  // Search: match note content across the whole workspace (case-insensitive
  // substring, v1). Returns each match with the passage context needed to jump
  // to it. Scripture-reference matching is done client-side (parseScriptureQuery)
  // and is NOT part of this method — this searches note text only.
  searchNotes(query: string): Promise<NoteSearchResult[]>

  // Scripture
  getBibleVerse(reference: string): Promise<BiblePassage | null>
}
