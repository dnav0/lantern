import type { SupabaseClient } from '@supabase/supabase-js'
import type { BereanApi } from './types'
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
import { getBibleVerse } from '../bible/service'

// SupabaseBereanApi: the single mutation choke point against Postgres. Every id
// is client-generated (crypto.randomUUID) and every timestamp is client-set — the
// same offline-sync-ready contract the memory stub follows. Cascade-downward is
// handled by ON DELETE CASCADE in the DB; the upward emptiness cleanup (empty
// session -> delete, empty passage -> delete) is done explicitly here, mirroring
// the legacy desktop behaviour.

const uuid = (): string => crypto.randomUUID()
const now = (): string => new Date().toISOString()

// Fields we read back for a Passage. workspace_id is included but the caller
// never needs to set it beyond the resolved personal workspace.
const PASSAGE_COLS =
  'id, workspace_id, book_number, chapter_start, verse_start, chapter_end, verse_end, reference_label, created_at'
const NOTE_COLS =
  'id, session_id, content, anchor_start_verse, anchor_end_verse, anchor_book_override, anchor_chapter_override, category, indent_level, created_at, updated_at'

export class SupabaseBereanApi implements BereanApi {
  private readonly db: SupabaseClient
  private readonly workspaceId: string
  private readonly userId: string

  private constructor(db: SupabaseClient, workspaceId: string, userId: string) {
    this.db = db
    this.workspaceId = workspaceId
    this.userId = userId
  }

  // Resolve the signed-in user's personal workspace once and cache it on the
  // instance. Called after login; the resulting api is provided to the tree.
  static async create(db: SupabaseClient): Promise<SupabaseBereanApi> {
    const { data: userData, error: userErr } = await db.auth.getUser()
    if (userErr) throw userErr
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data, error } = await db
      .from('workspaces')
      .select('id')
      .eq('kind', 'personal')
      .eq('created_by', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    if (error) throw error
    return new SupabaseBereanApi(db, data.id as string, userId)
  }

  private assert<T>(data: T | null, error: { message: string } | null): T {
    if (error) throw new Error(error.message)
    if (data === null) throw new Error('No data returned')
    return data
  }

  async getPassages(): Promise<Passage[]> {
    const { data, error } = await this.db
      .from('passages')
      .select(PASSAGE_COLS)
      .eq('workspace_id', this.workspaceId)
      .order('reference_label', { ascending: true })
    return this.assert(data, error) as Passage[]
  }

  async getPassagesByBook(bookNumber: number): Promise<Passage[]> {
    const { data, error } = await this.db
      .from('passages')
      .select(PASSAGE_COLS)
      .eq('workspace_id', this.workspaceId)
      .eq('book_number', bookNumber)
    return this.assert(data, error) as Passage[]
  }

  async getPassageById(id: string): Promise<Passage | null> {
    const { data, error } = await this.db.from('passages').select(PASSAGE_COLS).eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return (data as Passage) ?? null
  }

  async createPassage(input: CreatePassageInput): Promise<Passage> {
    const row = {
      id: uuid(),
      workspace_id: this.workspaceId,
      created_at: now(),
      ...input
    }
    const { data, error } = await this.db.from('passages').insert(row).select(PASSAGE_COLS).single()
    return this.assert(data, error) as Passage
  }

  async deletePassageAll(passageId: string): Promise<{ deletedPassageId: string }> {
    // ON DELETE CASCADE removes sessions and notes underneath.
    const { error } = await this.db.from('passages').delete().eq('id', passageId)
    if (error) throw new Error(error.message)
    return { deletedPassageId: passageId }
  }

  async getSessionsByPassage(passageId: string): Promise<Session[]> {
    const { data, error } = await this.db
      .from('sessions')
      .select('id, passage_id, created_at')
      .eq('passage_id', passageId)
      .order('created_at', { ascending: false })
    return this.assert(data, error) as Session[]
  }

  async createSession(passageId: string): Promise<Session> {
    const row = { id: uuid(), passage_id: passageId, created_at: now() }
    const { data, error } = await this.db
      .from('sessions')
      .insert(row)
      .select('id, passage_id, created_at')
      .single()
    return this.assert(data, error) as Session
  }

  async getNotesBySession(sessionId: string): Promise<Note[]> {
    const { data, error } = await this.db
      .from('notes')
      .select(NOTE_COLS)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    return this.assert(data, error) as Note[]
  }

  async getNotesByPassage(passageId: string): Promise<Note[]> {
    const sessions = await this.getSessionsByPassage(passageId)
    const ids = sessions.map(s => s.id)
    if (ids.length === 0) return []
    const { data, error } = await this.db
      .from('notes')
      .select(NOTE_COLS)
      .in('session_id', ids)
      .order('created_at', { ascending: true })
    return this.assert(data, error) as Note[]
  }

  async getNotesByBook(bookNumber: number): Promise<NoteWithPassageInfo[]> {
    // One join query: notes -> sessions -> passages filtered by book + workspace.
    const { data, error } = await this.db
      .from('notes')
      .select(
        `${NOTE_COLS}, sessions!inner ( passage_id, passages!inner ( workspace_id, book_number, chapter_start, chapter_end, verse_start, verse_end, reference_label, created_at ) )`
      )
      .eq('sessions.passages.workspace_id', this.workspaceId)
      .eq('sessions.passages.book_number', bookNumber)
      .order('created_at', { ascending: true })
    // Nested relations come back as objects (or arrays under some driver
    // versions); normalise defensively.
    const first = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v)
    const rows = this.assert(data, error) as unknown as Array<
      Record<string, unknown> & {
        sessions: { passages: Record<string, unknown> } | { passages: Record<string, unknown> }[]
      }
    >
    return rows.map(r => {
      const p = first(first(r.sessions).passages) as Record<string, unknown>
      const note = { ...r } as Record<string, unknown>
      delete note.sessions
      return {
        ...(note as unknown as Note),
        chapter_start: p.chapter_start as number,
        chapter_end: p.chapter_end as number,
        verse_start: p.verse_start as number,
        verse_end: p.verse_end as number,
        reference_label: p.reference_label as string
      }
    })
  }

  async createNote(input: CreateNoteInput): Promise<Note> {
    const ts = now()
    const row = { id: uuid(), created_by: this.userId, created_at: ts, updated_at: ts, ...input }
    const { data, error } = await this.db.from('notes').insert(row).select(NOTE_COLS).single()
    return this.assert(data, error) as Note
  }

  async updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
    const { data, error } = await this.db
      .from('notes')
      .update({ ...input, updated_at: now() })
      .eq('id', id)
      .select(NOTE_COLS)
      .single()
    return this.assert(data, error) as Note
  }

  async deleteNote(id: string): Promise<void> {
    const { error } = await this.db.from('notes').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteNoteAndCascade(id: string): Promise<DeleteNoteResult> {
    // Read the note's session before deleting so we can walk upward.
    const { data: noteRow, error: readErr } = await this.db
      .from('notes')
      .select('id, session_id')
      .eq('id', id)
      .maybeSingle()
    if (readErr) throw new Error(readErr.message)
    if (!noteRow) return { deletedNoteId: id }

    const sessionId = noteRow.session_id as string
    await this.deleteNote(id)
    const result: DeleteNoteResult = { deletedNoteId: id }

    // Empty session -> delete it.
    const { count: noteCount, error: cErr } = await this.db
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
    if (cErr) throw new Error(cErr.message)
    if ((noteCount ?? 0) > 0) return result

    const { data: sessionRow } = await this.db
      .from('sessions')
      .select('id, passage_id')
      .eq('id', sessionId)
      .maybeSingle()
    const { error: sDelErr } = await this.db.from('sessions').delete().eq('id', sessionId)
    if (sDelErr) throw new Error(sDelErr.message)
    result.deletedSessionId = sessionId
    if (!sessionRow) return result

    // Empty passage -> delete it.
    const passageId = sessionRow.passage_id as string
    const { count: sessCount, error: scErr } = await this.db
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('passage_id', passageId)
    if (scErr) throw new Error(scErr.message)
    if ((sessCount ?? 0) > 0) return result

    const { error: pDelErr } = await this.db.from('passages').delete().eq('id', passageId)
    if (pDelErr) throw new Error(pDelErr.message)
    result.deletedPassageId = passageId
    return result
  }

  async getBibleVerse(reference: string): Promise<BiblePassage | null> {
    // Scripture is not Supabase data — it's fetched client-side from BSB via
    // helloao (cached forever in IndexedDB). Delegate to the shared lookup so
    // both this and the memory stub share one implementation.
    return getBibleVerse(reference)
  }
}
