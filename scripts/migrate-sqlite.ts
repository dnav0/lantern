/**
 * One-time migration: legacy Electron SQLite (berean.db) -> Supabase Postgres.
 *
 * This is a Node script, run via `npx tsx`. Node APIs are allowed HERE only —
 * everything under src/ stays pure web (see CLAUDE.md). It uses the Supabase
 * service-role key to bypass RLS and insert into the target user's personal
 * workspace.
 *
 * Usage:
 *   npx tsx scripts/migrate-sqlite.ts \
 *     --db ./berean.db \
 *     --url https://xxxx.supabase.co \
 *     --service-key <service-role-key> \
 *     --user-email you@example.com
 *
 * It maps legacy int ids -> UUIDs (preserving created_at), maps book names ->
 * book_number via the same table src/utils/bibleBooks.ts uses, and prints a
 * before/after count summary plus a few sample notes.
 */
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import { BIBLE_BOOKS } from '../src/utils/bibleBooks'

// ─── args ────────────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const dbPath = arg('db')
const url = arg('url')
const serviceKey = arg('service-key')
const userEmail = arg('user-email')

if (!dbPath || !url || !serviceKey || !userEmail) {
  console.error(
    'Missing args. Usage:\n' +
      '  npx tsx scripts/migrate-sqlite.ts --db <path> --url <supabase-url> ' +
      '--service-key <key> --user-email <email>'
  )
  process.exit(1)
}

// Book-name -> book_number lookup, matching bibleBooks aliases + names.
const bookNumberByName = new Map<string, number>()
for (const b of BIBLE_BOOKS) {
  bookNumberByName.set(b.name.toLowerCase(), b.number)
  bookNumberByName.set(b.abbreviation.toLowerCase(), b.number)
  for (const a of b.aliases) bookNumberByName.set(a.toLowerCase(), b.number)
}

interface LegacyBook {
  id: number
  name: string
}
interface LegacyPassage {
  id: number
  book_id: number
  chapter_start: number
  verse_start: number
  chapter_end: number
  verse_end: number
  reference_label: string
}
interface LegacySession {
  id: number
  passage_id: number
  created_at: string
}
interface LegacyNote {
  id: number
  session_id: number
  content: string
  anchor_start_verse: number | null
  anchor_end_verse: number | null
  anchor_book_override: string | null
  anchor_chapter_override: number | null
  category: string | null
  indent_level: number
  created_at: string
}

// SQLite stores created_at as 'YYYY-MM-DD HH:MM:SS' (UTC). Convert to ISO.
function toIso(sqliteTs: string | null): string {
  if (!sqliteTs) return new Date().toISOString()
  const d = new Date(sqliteTs.replace(' ', 'T') + 'Z')
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

async function main(): Promise<void> {
  const sqlite = new Database(dbPath, { readonly: true })
  const supabase = createClient(url!, serviceKey!, { auth: { persistSession: false } })

  // Resolve the user + personal workspace.
  const { data: userList, error: userErr } = await supabase.auth.admin.listUsers()
  if (userErr) throw userErr
  const user = userList.users.find(u => u.email?.toLowerCase() === userEmail!.toLowerCase())
  if (!user) throw new Error(`No auth user found for ${userEmail}`)

  const { data: ws, error: wsErr } = await supabase
    .from('workspaces')
    .select('id')
    .eq('kind', 'personal')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (wsErr) throw new Error(`Could not find personal workspace: ${wsErr.message}`)
  const workspaceId = ws.id as string

  // Read legacy data.
  const books = sqlite.prepare('SELECT id, name FROM Books').all() as LegacyBook[]
  const passages = sqlite.prepare('SELECT * FROM Passages').all() as LegacyPassage[]
  const sessions = sqlite.prepare('SELECT * FROM Sessions').all() as LegacySession[]
  const notes = sqlite.prepare('SELECT * FROM Notes').all() as LegacyNote[]

  const bookNameById = new Map<number, string>()
  for (const b of books) bookNameById.set(b.id, b.name)

  console.log('── Source (SQLite) ──')
  console.log(`  passages: ${passages.length}`)
  console.log(`  sessions: ${sessions.length}`)
  console.log(`  notes:    ${notes.length}`)

  // Build id remaps.
  const passageUuid = new Map<number, string>()
  const sessionUuid = new Map<number, string>()

  const passageRows = passages.map(p => {
    const id = randomUUID()
    passageUuid.set(p.id, id)
    const bookName = bookNameById.get(p.book_id) ?? ''
    const bookNumber = bookNumberByName.get(bookName.toLowerCase())
    if (!bookNumber) {
      throw new Error(`Unmapped book "${bookName}" (legacy book_id ${p.book_id})`)
    }
    return {
      id,
      workspace_id: workspaceId,
      book_number: bookNumber,
      chapter_start: p.chapter_start,
      verse_start: p.verse_start,
      chapter_end: p.chapter_end,
      verse_end: p.verse_end,
      reference_label: p.reference_label,
      // Legacy Passages had no created_at; use epoch-ish stable value: now.
      created_at: new Date().toISOString()
    }
  })

  const sessionRows = sessions.map(s => {
    const id = randomUUID()
    sessionUuid.set(s.id, id)
    return {
      id,
      passage_id: passageUuid.get(s.passage_id)!,
      created_at: toIso(s.created_at)
    }
  })

  const noteRows = notes.map(n => ({
    id: randomUUID(),
    session_id: sessionUuid.get(n.session_id)!,
    content: n.content,
    anchor_start_verse: n.anchor_start_verse,
    anchor_end_verse: n.anchor_end_verse,
    anchor_book_override: n.anchor_book_override,
    anchor_chapter_override: n.anchor_chapter_override,
    category: n.category,
    indent_level: n.indent_level ?? 0,
    created_by: user.id,
    created_at: toIso(n.created_at),
    updated_at: toIso(n.created_at)
  }))

  // Insert in FK order.
  if (passageRows.length) {
    const { error } = await supabase.from('passages').insert(passageRows)
    if (error) throw new Error(`passages insert: ${error.message}`)
  }
  if (sessionRows.length) {
    const { error } = await supabase.from('sessions').insert(sessionRows)
    if (error) throw new Error(`sessions insert: ${error.message}`)
  }
  if (noteRows.length) {
    const { error } = await supabase.from('notes').insert(noteRows)
    if (error) throw new Error(`notes insert: ${error.message}`)
  }

  // After counts (this workspace only).
  const countIn = async (table: string, col: string, ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(col, ids)
    if (error) throw error
    return count ?? 0
  }
  const passageIds = passageRows.map(p => p.id)
  const sessionIds = sessionRows.map(s => s.id)
  const { count: pCount } = await supabase
    .from('passages')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  console.log('── Target (Supabase, this workspace) ──')
  console.log(`  passages: ${pCount ?? 0}`)
  console.log(`  sessions: ${await countIn('sessions', 'passage_id', passageIds)}`)
  console.log(`  notes:    ${await countIn('notes', 'session_id', sessionIds)}`)

  console.log('── Sample migrated notes ──')
  for (const n of noteRows.slice(0, 5)) {
    const preview = n.content.length > 70 ? n.content.slice(0, 70) + '…' : n.content
    console.log(`  [${n.category ?? '—'}] ${preview}`)
  }

  sqlite.close()
  console.log('Done.')
}

main().catch(err => {
  console.error('Migration failed:', err.message ?? err)
  process.exit(1)
})
