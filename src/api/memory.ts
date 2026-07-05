import type { BereanApi } from './types'
import type {
  Passage,
  Session,
  Note,
  NoteWithPassageInfo,
  CreatePassageInput,
  CreateNoteInput,
  UpdateNoteInput,
  DeleteNoteResult
} from '../types'
import { bookByNumber } from '../utils/bibleBooks'
import { parseReferenceLabel } from '../utils/noteParser'
import { getBibleVerse } from '../bible/service'

// In-memory BereanApi for Phase 0: the app runs end-to-end on fake data with no
// backend. State lives in module-scoped maps and resets on reload. Phase 1
// replaces this with SupabaseBereanApi behind the same interface.
//
// Scripture is real as of Phase 2: getBibleVerse delegates to
// src/bible/service.ts (BSB via helloao, cached in IndexedDB) — there is no
// backend dependency for reading scripture, so the memory stub gets it free.

const WORKSPACE_ID = 'personal-stub'

const uuid = (): string => crypto.randomUUID()
const now = (): string => new Date().toISOString()

const passages = new Map<string, Passage>()
const sessions = new Map<string, Session>()
const notes = new Map<string, Note>()

function passageInfo(p: Passage): Omit<NoteWithPassageInfo, keyof Note> {
  return {
    chapter_start: p.chapter_start,
    chapter_end: p.chapter_end,
    verse_start: p.verse_start,
    verse_end: p.verse_end,
    reference_label: p.reference_label
  }
}

export function createMemoryApi(): BereanApi {
  return {
    async getPassages() {
      return [...passages.values()].sort((a, b) => a.reference_label.localeCompare(b.reference_label))
    },

    async getPassagesByBook(bookNumber) {
      return [...passages.values()].filter(p => p.book_number === bookNumber)
    },

    async getPassageById(id) {
      return passages.get(id) ?? null
    },

    async createPassage(data: CreatePassageInput) {
      const p: Passage = {
        id: uuid(),
        workspace_id: WORKSPACE_ID,
        created_at: now(),
        ...data
      }
      passages.set(p.id, p)
      return p
    },

    async deletePassageAll(passageId) {
      for (const s of sessions.values()) {
        if (s.passage_id !== passageId) continue
        for (const n of notes.values()) {
          if (n.session_id === s.id) notes.delete(n.id)
        }
        sessions.delete(s.id)
      }
      passages.delete(passageId)
      return { deletedPassageId: passageId }
    },

    async getSessionsByPassage(passageId) {
      return [...sessions.values()]
        .filter(s => s.passage_id === passageId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    },

    async createSession(passageId) {
      const s: Session = { id: uuid(), passage_id: passageId, created_at: now() }
      sessions.set(s.id, s)
      return s
    },

    async getNotesBySession(sessionId) {
      return [...notes.values()]
        .filter(n => n.session_id === sessionId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    },

    async getNotesByPassage(passageId) {
      const sessionIds = new Set(
        [...sessions.values()].filter(s => s.passage_id === passageId).map(s => s.id)
      )
      return [...notes.values()]
        .filter(n => sessionIds.has(n.session_id))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    },

    async getNotesByBook(bookNumber) {
      const bookPassages = [...passages.values()].filter(p => p.book_number === bookNumber)
      const result: NoteWithPassageInfo[] = []
      for (const p of bookPassages) {
        const sessionIds = new Set(
          [...sessions.values()].filter(s => s.passage_id === p.id).map(s => s.id)
        )
        for (const n of notes.values()) {
          if (sessionIds.has(n.session_id)) result.push({ ...n, ...passageInfo(p) })
        }
      }
      return result.sort((a, b) => a.created_at.localeCompare(b.created_at))
    },

    async createNote(data: CreateNoteInput) {
      const n: Note = { id: uuid(), created_at: now(), updated_at: now(), ...data }
      notes.set(n.id, n)
      return n
    },

    async updateNote(id, data: UpdateNoteInput) {
      const existing = notes.get(id)
      if (!existing) throw new Error(`Note ${id} not found`)
      const updated: Note = { ...existing, ...data, updated_at: now() }
      notes.set(id, updated)
      return updated
    },

    async deleteNote(id) {
      notes.delete(id)
    },

    async deleteNoteAndCascade(id): Promise<DeleteNoteResult> {
      const note = notes.get(id)
      if (!note) return { deletedNoteId: id }
      notes.delete(id)
      const result: DeleteNoteResult = { deletedNoteId: id }

      const sessionId = note.session_id
      const sessionEmpty = ![...notes.values()].some(n => n.session_id === sessionId)
      if (!sessionEmpty) return result
      const session = sessions.get(sessionId)
      sessions.delete(sessionId)
      result.deletedSessionId = sessionId
      if (!session) return result

      const passageId = session.passage_id
      const passageEmpty = ![...sessions.values()].some(s => s.passage_id === passageId)
      if (!passageEmpty) return result
      passages.delete(passageId)
      result.deletedPassageId = passageId
      return result
    },

    async getBibleVerse(reference) {
      return getBibleVerse(reference)
    }
  }
}

// Seed a little sample data so the app isn't empty on first run.
export function seedMemoryApi(api: BereanApi): void {
  void (async () => {
    if (passages.size > 0) return
    const ref = 'John 1:1-5'
    const parsed = parseReferenceLabel(ref)!
    const passage = await api.createPassage({
      book_number: bookByNumber(43)?.number ?? 43, // John
      chapter_start: parsed.chapter_start,
      verse_start: parsed.verse_start,
      chapter_end: parsed.chapter_end,
      verse_end: parsed.verse_end,
      reference_label: ref
    })
    const session = await api.createSession(passage.id)
    await api.createNote({
      session_id: session.id,
      content: 'v1 The Word was with God and was God. @observation',
      anchor_start_verse: 1,
      anchor_end_verse: 1,
      anchor_book_override: null,
      anchor_chapter_override: null,
      category: 'observation',
      indent_level: 0
    })
  })()
}
