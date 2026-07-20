import { describe, it, expect, beforeEach, vi } from 'vitest'

// draft.ts talks to the real browser indexedDB global, which doesn't exist
// under Vitest's node environment (no jsdom/happy-dom in this repo — see
// package.json). Rather than pull in a new dependency for this, this is a
// minimal in-memory stand-in covering exactly the subset of the IndexedDB API
// draft.ts actually uses: one object store, keyPath 'key', put/get/delete.
class FakeRequest<T> {
  result: T | undefined
  error: unknown = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
}

class FakeTransaction {
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(private readonly store: FakeObjectStore) {}
  objectStore(_name: string): FakeObjectStore {
    return this.store
  }
  private finish(): void {
    queueMicrotask(() => this.oncomplete?.())
  }
  // put/delete resolve synchronously in this fake, so signal completion right
  // after the caller wires up oncomplete.
  _complete(): void {
    this.finish()
  }
}

class FakeObjectStore {
  constructor(private readonly rows: Map<string, unknown>) {}
  put(row: { key: string }): FakeRequest<undefined> {
    this.rows.set(row.key, row)
    return new FakeRequest()
  }
  get(key: string): FakeRequest<unknown> {
    const req = new FakeRequest<unknown>()
    queueMicrotask(() => {
      req.result = this.rows.get(key)
      req.onsuccess?.()
    })
    return req
  }
  delete(key: string): FakeRequest<undefined> {
    this.rows.delete(key)
    return new FakeRequest()
  }
}

class FakeDatabase {
  rows = new Map<string, unknown>()
  objectStoreNames = {
    contains: (name: string) => name === 'drafts'
  }
  createObjectStore(_name: string, _opts: { keyPath: string }): FakeObjectStore {
    return new FakeObjectStore(this.rows)
  }
  transaction(_name: string, _mode: string): FakeTransaction {
    const tx = new FakeTransaction(new FakeObjectStore(this.rows))
    // put()/delete() above already applied synchronously; complete on the
    // next microtask so callers that set oncomplete after calling put/delete
    // (as draft.ts does) still observe it.
    queueMicrotask(() => tx.oncomplete?.())
    return tx
  }
}

function installFakeIndexedDB(): void {
  const db = new FakeDatabase()
  const factory = {
    open: (_name: string, _version: number) => {
      const req = new FakeRequest<FakeDatabase>()
      queueMicrotask(() => {
        req.result = db
        req.onsuccess?.()
      })
      return req as unknown as IDBOpenDBRequest
    }
  }
  vi.stubGlobal('indexedDB', factory)
}

describe('offline/draft — persist/restore/clear cycle', () => {
  beforeEach(() => {
    installFakeIndexedDB()
    vi.resetModules()
  })

  it('readDraft returns null when nothing was ever written', async () => {
    const { readDraft } = await import('./draft')
    expect(await readDraft('passage:abc')).toBeNull()
  })

  it('round-trips a written draft', async () => {
    const { writeDraft, readDraft } = await import('./draft')
    await writeDraft('passage:abc', {
      reference: 'John 3:16',
      lines: [{ text: 'For God so loved the world', indent: 0 }]
    })
    const draft = await readDraft('passage:abc')
    expect(draft).toEqual({
      reference: 'John 3:16',
      lines: [{ text: 'For God so loved the world', indent: 0 }]
    })
  })

  it('a later write overwrites the earlier one for the same key', async () => {
    const { writeDraft, readDraft } = await import('./draft')
    await writeDraft('new:John 3:16', {
      reference: 'John 3:16',
      lines: [{ text: 'v1', indent: 0 }]
    })
    await writeDraft('new:John 3:16', {
      reference: 'John 3:16',
      lines: [{ text: 'v2', indent: 0 }]
    })
    const draft = await readDraft('new:John 3:16')
    expect(draft?.lines).toEqual([{ text: 'v2', indent: 0 }])
  })

  it('clearDraft removes the entry so a later read is a miss', async () => {
    const { writeDraft, readDraft, clearDraft } = await import('./draft')
    await writeDraft('passage:abc', {
      reference: 'John 3:16',
      lines: [{ text: 'hello', indent: 0 }]
    })
    await clearDraft('passage:abc')
    expect(await readDraft('passage:abc')).toBeNull()
  })

  it('drafts under different keys do not collide', async () => {
    const { writeDraft, readDraft } = await import('./draft')
    await writeDraft('passage:a', {
      reference: 'Matt 5:9',
      lines: [{ text: 'peacemakers', indent: 0 }]
    })
    await writeDraft('passage:b', {
      reference: 'Rom 8:28',
      lines: [{ text: 'all things', indent: 0 }]
    })
    expect((await readDraft('passage:a'))?.lines[0].text).toBe('peacemakers')
    expect((await readDraft('passage:b'))?.lines[0].text).toBe('all things')
  })
})

describe('offline/draft — draftKey', () => {
  it('keys by passage id when one exists, regardless of reference', async () => {
    const { draftKey } = await import('./draft')
    expect(draftKey('passage-123', 'anything')).toBe('passage:passage-123')
  })

  it('keys by the trimmed reference when there is no passage id yet', async () => {
    const { draftKey } = await import('./draft')
    expect(draftKey(null, '  John 3:16  ')).toBe('new:John 3:16')
  })

  it('returns null when there is neither a passage id nor a reference', async () => {
    const { draftKey } = await import('./draft')
    expect(draftKey(null, '   ')).toBeNull()
  })
})

describe('offline/draft — draftLinesEqual', () => {
  it('treats identical line arrays as equal', async () => {
    const { draftLinesEqual } = await import('./draft')
    const a = [
      { text: 'hello', indent: 0 },
      { text: 'world', indent: 1, noteId: 'n1' }
    ]
    const b = [
      { text: 'hello', indent: 0 },
      { text: 'world', indent: 1, noteId: 'n1' }
    ]
    expect(draftLinesEqual(a, b)).toBe(true)
  })

  it('detects a text difference', async () => {
    const { draftLinesEqual } = await import('./draft')
    expect(draftLinesEqual([{ text: 'a', indent: 0 }], [{ text: 'b', indent: 0 }])).toBe(false)
  })

  it('detects a length difference', async () => {
    const { draftLinesEqual } = await import('./draft')
    expect(
      draftLinesEqual(
        [{ text: 'a', indent: 0 }],
        [
          { text: 'a', indent: 0 },
          { text: 'b', indent: 0 }
        ]
      )
    ).toBe(false)
  })
})
