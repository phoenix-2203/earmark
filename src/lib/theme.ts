/**
 * Theme management — System / Light / Dark.
 * Persisted in localStorage under 'earmark.theme'.
 * "system" removes data-theme; "light"/"dark" sets it.
 */
import { useState, useEffect, useCallback } from 'react'

export type ThemeChoice    = 'system' | 'light' | 'dark'
export type EffectiveTheme = 'light' | 'dark'

const KEY = 'earmark.theme'

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch (_) {}
  return 'system'
}

function applyChoice(choice: ThemeChoice) {
  try {
    if (choice === 'system') {
      document.documentElement.removeAttribute('data-theme')
      localStorage.removeItem(KEY)
    } else {
      document.documentElement.setAttribute('data-theme', choice)
      localStorage.setItem(KEY, choice)
    }
  } catch (_) {}
}

/** Returns the theme choice and a setter. */
export function useTheme(): { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice)
  const setChoice = useCallback((c: ThemeChoice) => {
    applyChoice(c)
    setChoiceState(c)
  }, [])
  return { choice, setChoice }
}

/**
 * Returns the effective (rendered) theme: 'light' or 'dark'.
 * Listens to the system media query when choice is 'system'.
 */
export function useEffectiveTheme(): EffectiveTheme {
  const [choice] = useState<ThemeChoice>(readChoice)
  const [sysDark, setSysDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function handle(e: MediaQueryListEvent) { setSysDark(e.matches) }
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [])

  // Re-read data-theme attribute directly so it reflects updates from useTheme
  const [attr, setAttr] = useState(
    () => document.documentElement.getAttribute('data-theme') as ThemeChoice | null,
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setAttr(document.documentElement.getAttribute('data-theme') as ThemeChoice | null)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const effective = attr === 'dark' ? 'dark' : attr === 'light' ? 'light' : sysDark ? 'dark' : 'light'
  void choice // suppress unused warning — choice is read at init only
  return effective
}
