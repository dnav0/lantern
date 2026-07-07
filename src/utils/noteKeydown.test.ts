import { describe, it, expect } from 'vitest'
import { decideEnter, decideBackspace, KeyLineState } from './noteKeydown'

function state(partial: Partial<KeyLineState>): KeyLineState {
  return { text: '', indent: 0, caret: 0, lineCount: 1, ...partial }
}

describe('decideEnter', () => {
  it('outdents an empty bullet at indent > 0 (keeps the bullet, no new line)', () => {
    expect(decideEnter(state({ text: '', indent: 1 }))).toEqual({ type: 'outdent' })
  })

  it('treats a whitespace-only indented bullet as empty', () => {
    expect(decideEnter(state({ text: '   ', indent: 1 }))).toEqual({ type: 'outdent' })
  })

  it('is a no-op on an empty level-0 bullet (does not create a stray line)', () => {
    expect(decideEnter(state({ text: '', indent: 0 }))).toEqual({ type: 'noop' })
  })

  it('inserts a new line when the bullet has content (indent 0)', () => {
    expect(decideEnter(state({ text: 'grace abounds', indent: 0 }))).toEqual({ type: 'insert-line' })
  })

  it('inserts a new line when an indented bullet has content', () => {
    expect(decideEnter(state({ text: 'sub point', indent: 1 }))).toEqual({ type: 'insert-line' })
  })

  it('does not confuse tag/verse tokens for emptiness', () => {
    // A line that is only a tag/verse token is still "content" — never outdented.
    expect(decideEnter(state({ text: '@observation', indent: 1 }))).toEqual({ type: 'insert-line' })
    expect(decideEnter(state({ text: 'v4', indent: 1 }))).toEqual({ type: 'insert-line' })
  })
})

describe('decideBackspace', () => {
  it('outdents an empty indented bullet with the caret at the start', () => {
    expect(decideBackspace(state({ text: '', indent: 1, caret: 0 }))).toEqual({ type: 'outdent' })
  })

  it('outdents a whitespace-only indented bullet at the start', () => {
    expect(decideBackspace(state({ text: '  ', indent: 1, caret: 0 }))).toEqual({ type: 'outdent' })
  })

  it('defers to default handling on an empty level-0 bullet', () => {
    expect(decideBackspace(state({ text: '', indent: 0, caret: 0 }))).toEqual({ type: 'default' })
  })

  it('defers when the indented bullet has text (delete a char instead)', () => {
    expect(decideBackspace(state({ text: 'a', indent: 1, caret: 1 }))).toEqual({ type: 'default' })
  })

  it('defers when the caret is not at the start', () => {
    expect(decideBackspace(state({ text: '', indent: 1, caret: 2 }))).toEqual({ type: 'default' })
  })
})
