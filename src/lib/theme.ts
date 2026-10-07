export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'learnforge:theme'

export function getInitialTheme(): Theme {
  // The blocking head script resolves the preference before the first paint.
  const bootstrapped = document.documentElement.dataset.theme
  if (bootstrapped === 'light' || bootstrapped === 'dark') return bootstrapped
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* Storage can be unavailable in restricted browsing contexts. */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function saveTheme(theme: Theme): void {
  applyTheme(theme)
  try { window.localStorage.setItem(THEME_STORAGE_KEY, theme) }
  catch { /* The chosen theme still works for this visit when storage is blocked. */ }
}
