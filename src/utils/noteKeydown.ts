// Pure decision logic for the note editor's Enter / Backspace / Tab handling.
//
// The DOM-facing keydown handler lives in NoteEditor.tsx; this module holds only
// the *decisions* so they can be unit-tested without a contentEditable or a
// browser selection. Tag parsing stays in noteParser.ts — this file never looks
// at tag syntax, it only reasons about indent + emptiness + caret position.

export interface KeyLineState {
  /** Raw text of the focused line. */
  text: string
  /** Indent level of the focused line (0 = root, 1 = sub-note). */
  indent: number
  /** Caret offset within the raw text (collapsed selection assumed). */
  caret: number
  /** Total number of lines in the editor. */
  lineCount: number
}

export type KeyAction =
  | { type: 'outdent' } //           keep the bullet, drop one indent level
  | { type: 'insert-line' } //       split/create a new bullet at same indent
  | { type: 'noop' } //              swallow the key, do nothing
  | { type: 'default' } //           let the browser / other handlers act

/**
 * Enter with the tag dropdown closed.
 *   - empty bullet, indent > 0 → outdent one level (no new line)
 *   - empty bullet, indent = 0 → no-op (swallow; don't create a stray line)
 *   - otherwise                → insert a new bullet at the same indent
 */
export function decideEnter(s: KeyLineState): KeyAction {
  const empty = s.text.trim() === ''
  if (empty) {
    return s.indent > 0 ? { type: 'outdent' } : { type: 'noop' }
  }
  return { type: 'insert-line' }
}

/**
 * Backspace with the tag dropdown closed and a collapsed selection.
 * Only the "outdent an empty indented bullet" case is decided here; every other
 * Backspace situation (merge with previous line, delete a char, delete an empty
 * root line) is left to the existing NoteEditor logic via { type: 'default' }.
 */
export function decideBackspace(s: KeyLineState): KeyAction {
  const empty = s.text.trim() === ''
  if (empty && s.indent > 0 && s.caret === 0) {
    return { type: 'outdent' }
  }
  return { type: 'default' }
}
