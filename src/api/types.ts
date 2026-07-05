import type {
  Passage,
  Session,
  Note,
  NoteWithPassageInfo,
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

  // Scripture
  getBibleVerse(reference: string): Promise<BiblePassage | null>
}
