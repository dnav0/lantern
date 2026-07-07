import { describe, it, expect } from 'vitest'
import { parseNoteLine, parseReferenceLabel } from './noteParser'

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
      chapter_start: 3, verse_start: 16, chapter_end: 3, verse_end: 16
    })
  })

  it('parses a verse range', () => {
    expect(parseReferenceLabel('Matt 5:1-12')).toEqual({
      chapter_start: 5, verse_start: 1, chapter_end: 5, verse_end: 12
    })
  })

  it('returns null for an unparseable reference', () => {
    expect(parseReferenceLabel('not a reference')).toBeNull()
  })
})
