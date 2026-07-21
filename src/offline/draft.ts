// offline/draft.ts — IndexedDB persistence for an in-progress note draft, so a
// tab close/reload before a save succeeds doesn't destroy typed content. See
// docs/proposals/offline-write-outbox.md: this is the small, safe first step
// that document recommends instead of a full write outbox — draft recovery
// only, no queue, no replay, no conflict reconciliation. A device only ever
// recovers its own draft.
//
// Same shape as src/offline/mirror.ts and src/bible/cache.ts: one small
// IndexedDB store, write-through, best-effort, swallow errors.

const DB_NAME = 'berean-note-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

export interface DraftLine {
  text: string
  indent: number
  noteId?: string
}

export interface Draft {
  reference: string
  lines: DraftLine[]
}

interface DraftRow extends Draft {
  key: string
  savedAt: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

// A study is identified by its passage id once one exists, or by the trimmed
// reference label before that (a blank study has no passage until the first
// save). Returns null when neither is available yet — nothing to key a
// draft by, so callers should not attempt to persist or restore.
export function draftKey(passageId: string | null, reference: string): string | null {
  if (passageId) return `passage:${passageId}`
  const trimmed = reference.trim()
  return trimmed ? `new:${trimmed}` : null
}

export function draftLinesEqual(a: DraftLine[], b: DraftLine[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (line, i) =>
      line.text === b[i].text && line.indent === b[i].indent && line.noteId === b[i].noteId
  )
}

export async function writeDraft(key: string, draft: Draft): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({
        key,
        reference: draft.reference,
        lines: draft.lines,
        savedAt: new Date().toISOString()
      } satisfies DraftRow)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Best-effort; a failed draft write just means no recovery for this edit
    // if the tab closes before the next successful write or save.
  }
}

export async function readDraft(key: string): Promise<Draft | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => {
        const row = req.result as DraftRow | undefined
        resolve(row ? { reference: row.reference, lines: row.lines } : null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Best-effort; worst case a stale draft lingers until overwritten.
  }
}
