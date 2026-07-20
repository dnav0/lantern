import { describe, it, expect } from 'vitest'
import { parseNoteLine, parseReferenceLabel, parseScriptureQuery } from './noteParser'

// Regression coverage for the tag-parsing layer. The workstream-4 keydown changes
// must NOT touch this behavior — these tests pin it so a regression fails loudly.

describe('parseNoteLine — @ category tags', () => {
  it('recognizes a full @observation tag and extracts the category', () => {
    const p = parseNoteLine('@observation the Word was God')
    expect(p.category).toBe('observation')
    const tag = p.segments.find(s => s.type === 'tag')
    expect(tag?.data?.category).toBe('observation')
    expect(tag?.display).toBe('@observation')
  })

  it('normalizes shorthand tags (@obs, @hist, @app, @per)', () => {
    expect(parseNoteLine('@obs x').category).toBe('observation')
    expect(parseNoteLine('@hist x').category).toBe('historical')
    expect(parseNoteLine('@app x').category).toBe('application')
    expect(parseNoteLine('@per x').category).toBe('personal')
  })

  it('keeps the first tag when several appear', () => {
    expect(parseNoteLine('@application then @personal').category).toBe('application')
  })
})

describe('parseNoteLine — verse anchors', () => {
  it('parses a single verse anchor (v4)', () => {
    const p = parseNoteLine('v4 the light shines')
    expect(p.anchorStart).toBe(4)
    expect(p.anchorEnd).toBe(4)
    const seg = p.segments.find(s => s.type === 'verse-anchor')
    expect(seg?.data?.startVerse).toBe(4)
  })

  it('parses a verse range (v3-5)', () => {
    const p = parseNoteLine('v3-5 a cluster')
    expect(p.anchorStart).toBe(3)
    expect(p.anchorEnd).toBe(5)
  })

  it('takes the first anchor when several appear', () => {
    const p = parseNoteLine('v2 and later v9')
    expect(p.anchorStart).toBe(2)
    expect(p.anchorEnd).toBe(2)
  })

  it('tags and verse anchors coexist on one line', () => {
    const p = parseNoteLine('v1 @historical context here')
    expect(p.anchorStart).toBe(1)
    expect(p.category).toBe('historical')
  })
})

describe('parseReferenceLabel', () => {
  it('parses a single verse reference', () => {
    expect(parseReferenceLabel('John 3:16')).toEqual({
      chapter_start: 3,
      verse_start: 16,
      chapter_end: 3,
      verse_end: 16
    })
  })

  it('parses a verse range', () => {
    expect(parseReferenceLabel('Matt 5:1-12')).toEqual({
      chapter_start: 5,
      verse_start: 1,
      chapter_end: 5,
      verse_end: 12
    })
  })

  it('returns null for an unparseable reference', () => {
    expect(parseReferenceLabel('not a reference')).toBeNull()
  })
})

describe('parseScriptureQuery — search reference jump', () => {
  it('parses an abbreviation + chapter + verse ("mat 2:13")', () => {
    expect(parseScriptureQuery('mat 2:13')).toEqual([
      { bookNumber: 40, bookName: 'Matthew', chapter: 2, verse: 13, kind: 'verse' }
    ])
  })

  it('parses a full book name + chapter only ("john 1")', () => {
    expect(parseScriptureQuery('john 1')).toEqual([
      { bookNumber: 43, bookName: 'John', chapter: 1, verse: null, kind: 'chapter' }
    ])
  })

  it('parses a numbered book ("1 cor 13:4")', () => {
    expect(parseScriptureQuery('1 cor 13:4')).toEqual([
      { bookNumber: 46, bookName: '1 Corinthians', chapter: 13, verse: 4, kind: 'verse' }
    ])
  })

  it('is case- and whitespace-insensitive', () => {
    expect(parseScriptureQuery('  GEN   3 ')).toEqual([
      { bookNumber: 1, bookName: 'Genesis', chapter: 3, verse: null, kind: 'chapter' }
    ])
  })

  it('clamps an over-large chapter to the book maximum', () => {
    // Jude has a single chapter; asking for 9 clamps to 1.
    expect(parseScriptureQuery('jude 9')[0]?.chapter).toBe(1)
  })

  it('returns a single unambiguous book jump for a bare full name ("matthew")', () => {
    expect(parseScriptureQuery('matthew')).toEqual([
      { bookNumber: 40, bookName: 'Matthew', chapter: 1, verse: null, kind: 'book' }
    ])
  })

  it('returns a single unambiguous book jump for a bare prefix ("matt")', () => {
    expect(parseScriptureQuery('matt')).toEqual([
      { bookNumber: 40, bookName: 'Matthew', chapter: 1, verse: null, kind: 'book' }
    ])
  })

  it('returns a single unambiguous book jump for "rom"', () => {
    expect(parseScriptureQuery('rom')).toEqual([
      { bookNumber: 45, bookName: 'Romans', chapter: 1, verse: null, kind: 'book' }
    ])
  })

  it('returns a single unambiguous book jump for a numbered-book prefix ("1 cor")', () => {
    expect(parseScriptureQuery('1 cor')).toEqual([
      { bookNumber: 46, bookName: '1 Corinthians', chapter: 1, verse: null, kind: 'book' }
    ])
  })

  it('returns multiple ranked results for an ambiguous prefix ("jo")', () => {
    const results = parseScriptureQuery('jo')
    expect(results.length).toBeGreaterThan(1)
    expect(results.length).toBeLessThanOrEqual(5)
    expect(results.every(r => r.kind === 'book' && r.chapter === 1 && r.verse === null)).toBe(true)
    // John's alias list includes the exact alias "jo"; Joel/Jonah/Job/Joshua
    // etc. only startsWith/contains-match "jo" — exact match ranks first.
    expect(results[0].bookName).toBe('John')
  })

  it('caps ambiguous single-letter prefixes ("j") at 5 results, exact/startsWith ordered first', () => {
    const results = parseScriptureQuery('j')
    expect(results.length).toBe(5)
    // Many books have an alias starting with "j" (Joshua "jos", Judges "jdg"
    // no — but "judges"/"jud" etc.); no exact alias is just "j", so ranking
    // falls back to canonical book order (BIBLE_BOOKS / USFM order) among the
    // startsWith matches, capped at 5.
    const names = results.map(r => r.bookName)
    expect(names).toEqual(['Joshua', 'Judges', 'Job', 'Jeremiah', 'Joel'])
  })

  it('returns an empty array for an unknown book', () => {
    expect(parseScriptureQuery('hesitations 3:1')).toEqual([])
  })

  it('returns an empty array for empty input', () => {
    expect(parseScriptureQuery('')).toEqual([])
  })
})
