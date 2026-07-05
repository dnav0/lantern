// BibleProvider is the scripture source seam. BSB via bible.helloao.org
// (helloao.ts) is the first implementation; a future KJV or user-keyed ESV
// provider implements the same interface. A cache layer (cache.ts) wraps any
// provider — chapters are immutable, so once fetched they're cached forever.
export interface BibleVerseLine {
  verse: number
  text: string
}

export interface BibleProvider {
  getChapter(bookNumber: number, chapter: number): Promise<BibleVerseLine[]>
}
