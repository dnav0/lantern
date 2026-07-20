import { describe, it, expect } from 'vitest'
import {
  BIBLE_BOOKS,
  bookByNumber,
  findBookByAlias,
  buildCrossRefRegex,
  normalizeReference
} from './bibleBooks'

describe('BIBLE_BOOKS', () => {
  it('has exactly 66 entries', () => {
    expect(BIBLE_BOOKS).toHaveLength(66)
  })

  it('numbers books 1..66 in canonical order', () => {
    expect(BIBLE_BOOKS.map(b => b.number)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1))
  })

  it('starts with Genesis (1) and ends with Revelation (66)', () => {
    expect(BIBLE_BOOKS[0]).toMatchObject({ number: 1, name: 'Genesis' })
    expect(BIBLE_BOOKS[65]).toMatchObject({ number: 66, name: 'Revelation' })
  })

  it('splits into 39 OT books and 27 NT books', () => {
    const ot = BIBLE_BOOKS.filter(b => b.testament === 'OT')
    const nt = BIBLE_BOOKS.filter(b => b.testament === 'NT')
    expect(ot).toHaveLength(39)
    expect(nt).toHaveLength(27)
  })
})

describe('bookByNumber', () => {
  it('returns the correct book for the first valid number', () => {
    expect(bookByNumber(1)?.name).toBe('Genesis')
  })

  it('returns the correct book for the last valid number', () => {
    expect(bookByNumber(66)?.name).toBe('Revelation')
  })

  it('returns the correct book for a mid-range number', () => {
    expect(bookByNumber(40)?.name).toBe('Matthew')
  })

  it('returns undefined for 0', () => {
    expect(bookByNumber(0)).toBeUndefined()
  })

  it('returns undefined for 67', () => {
    expect(bookByNumber(67)).toBeUndefined()
  })

  it('returns undefined for a negative number', () => {
    expect(bookByNumber(-5)).toBeUndefined()
  })
})

describe('findBookByAlias', () => {
  it('resolves a full lowercase name', () => {
    expect(findBookByAlias('genesis')?.name).toBe('Genesis')
  })

  it('resolves an abbreviation regardless of case', () => {
    expect(findBookByAlias('Gen')?.name).toBe('Genesis')
  })

  it('trims surrounding whitespace', () => {
    expect(findBookByAlias(' ge ')?.name).toBe('Genesis')
  })

  it('resolves a multi-word full name case-insensitively', () => {
    expect(findBookByAlias('Song of Solomon')?.name).toBe('Song of Solomon')
  })

  it('resolves a short alias for a multi-word book', () => {
    expect(findBookByAlias('sos')?.name).toBe('Song of Solomon')
  })

  it('returns undefined for unknown input', () => {
    expect(findBookByAlias('notabook')).toBeUndefined()
  })
})

describe('buildCrossRefRegex', () => {
  it('matches a simple single-chapter-word reference and captures book/chapter/verse', () => {
    const re = buildCrossRefRegex()
    const match = re.exec('John 3:16')
    expect(match).not.toBeNull()
    expect(match![1].toLowerCase()).toBe('john')
    expect(match![2]).toBe('3')
    expect(match![3]).toBe('16')
    expect(match![4]).toBeUndefined()
  })

  it('matches a reference with a verse range and captures the end verse', () => {
    const re = buildCrossRefRegex()
    const match = re.exec('Gen 1:1-3')
    expect(match).not.toBeNull()
    expect(match![1].toLowerCase()).toBe('gen')
    expect(match![2]).toBe('1')
    expect(match![3]).toBe('1')
    expect(match![4]).toBe('3')
  })

  it('matches case-insensitively', () => {
    const re = buildCrossRefRegex()
    const match = re.exec('JOHN 3:16')
    expect(match).not.toBeNull()
  })

  it('finds multiple references in a longer string', () => {
    const re = buildCrossRefRegex()
    const matches = [...'Read Gen 1:1-3 and John 3:16 today.'.matchAll(re)]
    expect(matches).toHaveLength(2)
    expect(matches[0][1].toLowerCase()).toBe('gen')
    expect(matches[1][1].toLowerCase()).toBe('john')
  })

  it('captures the full multi-word alias rather than a shorter prefix', () => {
    const re = buildCrossRefRegex()
    const match = re.exec('Song of Solomon 1:1')
    expect(match).not.toBeNull()
    expect(match![1].toLowerCase()).toBe('song of solomon')
  })

  it('orders alternatives longest-first so no alias is shadowed by a shorter prefix', () => {
    const re = buildCrossRefRegex()
    const groupSource = re.source.slice(re.source.indexOf('(') + 1, re.source.indexOf(')'))
    const alternatives = groupSource.split('|')
    const longIndex = alternatives.indexOf('song of solomon')
    const shortIndex = alternatives.indexOf('song')
    expect(longIndex).toBeGreaterThanOrEqual(0)
    expect(shortIndex).toBeGreaterThanOrEqual(0)
    expect(longIndex).toBeLessThan(shortIndex)
  })
})

describe('normalizeReference', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeReference('  John 3:16  ')).toBe('John 3:16')
  })

  it('collapses internal runs of whitespace to a single space', () => {
    expect(normalizeReference('John   3:16')).toBe('John 3:16')
  })

  it('trims and collapses together', () => {
    expect(normalizeReference('  John\t3:16   is\n\ngreat  ')).toBe('John 3:16 is great')
  })
})
