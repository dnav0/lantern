// offline/mirror.ts — whole-result IndexedDB mirror of BereanApi read queries.
//
// Design: no merging, no partial updates. Each mirrored read is keyed by
// `queryName + JSON(params)` and stores the entire result verbatim. On a
// successful network read, SupabaseBereanApi writes-through the fresh result
// here. On a network failure it falls back to whatever was last mirrored for
// that exact key and flags the response as served-from-mirror so the UI can
// show the "offline" pill. This is intentionally dumb — it's a read cache,
// not a sync engine; the real write outbox stays in docs/BACKLOG.md.

const DB_NAME = 'berean-offline-mirror'
const DB_VERSION = 1
const STORE_NAME = 'queries'

interface MirrorRow {
  key: string
  result: unknown
  storedAt: string
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

// Build a stable cache key from a query name and its params. Params are
// JSON-stringified as-is; call sites should pass primitives/plain objects
// (ids, book numbers) — nothing that varies in key order in a way that
// matters here (single-arg queries in practice).
export function mirrorKey(queryName: string, params?: unknown): string {
  return params === undefined ? queryName : `${queryName}:${JSON.stringify(params)}`
}

export async function writeMirror<T>(key: string, result: T): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({
        key,
        result,
        storedAt: new Date().toISOString()
      } satisfies MirrorRow)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Best-effort; a failed mirror write just means no offline fallback for
    // this key until the next successful read.
  }
}

export async function readMirror<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(((req.result as MirrorRow | undefined)?.result as T) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}
