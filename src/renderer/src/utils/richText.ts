import { parseNoteLine } from './noteParser'

/** Extract raw text from a rich contenteditable div. */
export function getRawText(el: HTMLElement): string {
  let s = ''
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      s += n.textContent ?? ''
    } else if ((n as HTMLElement).tagName === 'BR') {
      // ignore browser-inserted <br> in empty divs
    } else {
      s += (n as HTMLElement).dataset.raw ?? n.textContent ?? ''
    }
  }
  return s
}

/** Get cursor position as a raw-text offset. */
export function getRawCursorPos(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return 0
  const range = sel.getRangeAt(0)
  let pos = 0

  for (const child of Array.from(el.childNodes)) {
    if (child === range.startContainer || child.contains(range.startContainer)) {
      pos += child.nodeType === Node.TEXT_NODE ? range.startOffset : 0
      return pos
    }
    if (child.nodeType === Node.TEXT_NODE) {
      pos += child.textContent?.length ?? 0
    } else if ((child as HTMLElement).tagName !== 'BR') {
      pos += (child as HTMLElement).dataset.raw?.length ?? child.textContent?.length ?? 0
    }
  }

  if (range.startContainer === el) {
    let count = 0
    for (let i = 0; i < range.startOffset; i++) {
      const c = el.childNodes[i]
      if (!c) break
      if (c.nodeType === Node.TEXT_NODE) {
        count += c.textContent?.length ?? 0
      } else if ((c as HTMLElement).tagName !== 'BR') {
        count += (c as HTMLElement).dataset.raw?.length ?? c.textContent?.length ?? 0
      }
    }
    return count
  }

  return pos
}

/** Place a collapsed cursor at a raw-text offset. */
export function setRawCursorPos(el: HTMLElement, target: number): void {
  const sel = window.getSelection()
  if (!sel) return
  let rem = target
  const range = document.createRange()

  for (const child of Array.from(el.childNodes)) {
    if ((child as HTMLElement).tagName === 'BR') continue
    const len = child.nodeType === Node.TEXT_NODE
      ? (child.textContent?.length ?? 0)
      : ((child as HTMLElement).dataset.raw?.length ?? child.textContent?.length ?? 0)

    if (rem <= len) {
      if (child.nodeType === Node.TEXT_NODE) {
        range.setStart(child, Math.min(rem, child.textContent?.length ?? 0))
      } else {
        rem <= 0 ? range.setStartBefore(child) : range.setStartAfter(child)
      }
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    rem -= len
  }

  range.setStart(el, el.childNodes.length)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * Render rich text (pills for verse-anchor, tag, cross-ref) into a contenteditable div.
 * cursorPos: when provided, a token whose end offset equals the cursor is kept as plain
 * text — the user may still be typing it.
 * Returns true if the DOM was actually modified.
 */
export function renderRich(el: HTMLElement, text: string, cursorPos?: number): boolean {
  const { segments } = parseNoteLine(text)

  const frag = document.createDocumentFragment()
  let charPos = 0
  for (const seg of segments) {
    if (seg.type === 'text') {
      if (seg.raw) frag.appendChild(document.createTextNode(seg.raw))
    } else {
      const tokenEnd = charPos + seg.raw.length
      if (cursorPos !== undefined && cursorPos === tokenEnd) {
        frag.appendChild(document.createTextNode(seg.raw))
      } else {
        const span = document.createElement('span')
        span.contentEditable = 'false'
        span.dataset.raw = seg.raw
        if (seg.type === 'verse-anchor') span.className = 'pill-verse'
        else if (seg.type === 'tag') span.className = `pill-tag-${seg.data?.category ?? 'observation'}`
        else if (seg.type === 'cross-ref') span.className = 'pill-crossref'
        span.textContent = seg.display
        frag.appendChild(span)
      }
    }
    charPos += seg.raw.length
  }

  const serialise = (node: HTMLElement | DocumentFragment): string =>
    Array.from(node.childNodes)
      .map(n => n.nodeType === Node.TEXT_NODE ? n.textContent : (n as HTMLElement).outerHTML)
      .join('')

  if (serialise(el) === serialise(frag as unknown as HTMLElement)) return false
  while (el.firstChild) el.removeChild(el.firstChild)
  el.appendChild(frag)
  return true
}
