import { useEffect, useState } from 'react'
import { applyTheme, getInitialTheme, saveTheme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)
  useEffect(() => { applyTheme(theme) }, [theme])
  return <button type="button" className="theme-toggle" aria-pressed={theme === 'dark'}
    title={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'} onClick={() => {
      const next = theme === 'dark' ? 'light' : 'dark'
      saveTheme(next)
      setTheme(next)
    }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5a8.5 8.5 0 1 0 10.6 10.6Z" />
    </svg>
    <span>深色模式</span>
  </button>
}
