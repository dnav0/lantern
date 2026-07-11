import { useState, useEffect } from 'react'

const STORAGE_KEY = 'berean-visual-theme'

export type ThemeId = 'berean' | 'scholarly' | 'paper' | 'modern'

export const THEMES: { id: ThemeId; label: string; blurb: string }[] = [
  { id: 'berean', label: 'Berean', blurb: 'Warm cream + indigo (default)' },
  { id: 'scholarly', label: 'Scholarly Serif', blurb: 'Paper-white, quiet' },
  { id: 'paper', label: 'Warm Paper', blurb: 'Cream + amber warmth' },
  { id: 'modern', label: 'Quiet Modern', blurb: 'Cool, crisp sans reading' }
]

// Independent of light/dark mode (useDarkMode) — this picks the color/type
// direction; body.dark still layers on top of whichever theme is active.
export function useTheme(): [ThemeId, (t: ThemeId) => void] {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored as ThemeId) || 'berean'
  })

  useEffect(() => {
    if (theme === 'berean') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = (t: ThemeId): void => setThemeState(t)

  return [theme, setTheme]
}
