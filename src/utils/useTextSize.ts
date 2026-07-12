import { useState, useEffect } from 'react'

const STORAGE_KEY = 'berean-text-size'

export type TextSizeId = 'small' | 'medium' | 'large'

export const TEXT_SIZES: { id: TextSizeId; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium (default)' },
  { id: 'large', label: 'Large' }
]

// Independent of theme/dark mode — scales scripture type only (--scripture-size
// in tokens.css), via a `data-text-size` attribute on <html> mirroring
// useTheme.ts's pattern. "medium" is the unmarked default (no attribute), same
// convention as useTheme's "berean".
export function useTextSize(): [TextSizeId, (t: TextSizeId) => void] {
  const [textSize, setTextSizeState] = useState<TextSizeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored as TextSizeId) || 'medium'
  })

  useEffect(() => {
    if (textSize === 'medium') {
      document.documentElement.removeAttribute('data-text-size')
    } else {
      document.documentElement.setAttribute('data-text-size', textSize)
    }
    localStorage.setItem(STORAGE_KEY, textSize)
  }, [textSize])

  const setTextSize = (t: TextSizeId): void => setTextSizeState(t)

  return [textSize, setTextSize]
}
