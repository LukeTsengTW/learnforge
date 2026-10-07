// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../App'
import { AuthContext } from '../features/auth/auth-context'

function app() {
  return render(<StrictMode><AuthContext.Provider value={{ account: null, loading: false, error: null, service: null, refresh: async () => {} }}>
    <MemoryRouter><AppRoutes /></MemoryRouter>
  </AuthContext.Provider></StrictMode>)
}
function systemTheme(dark: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: dark })))
}
beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  systemTheme(false)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('global theme preference', () => {
  it.each([false, true])('uses the system default (dark: %s) without storing an explicit choice', (dark) => {
    systemTheme(dark)
    app()
    expect(document.documentElement).toHaveAttribute('data-theme', dark ? 'dark' : 'light')
    expect(screen.getByRole('button', { name: '深色模式' })).toHaveAttribute('aria-pressed', String(dark))
    expect(localStorage.getItem('learnforge:theme')).toBeNull()
  })
  it.each(['light', 'dark'])('restores saved %s even when the system prefers the other theme', (theme) => {
    localStorage.setItem('learnforge:theme', theme)
    systemTheme(theme === 'light')
    app()
    expect(document.documentElement).toHaveAttribute('data-theme', theme)
    expect(screen.getByRole('button', { name: '深色模式' })).toHaveAttribute('aria-pressed', String(theme === 'dark'))
  })
  it('uses the pre-paint theme selected by the bootstrap', () => {
    document.documentElement.dataset.theme = 'dark'
    app()
    expect(screen.getByRole('button', { name: '深色模式' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.length).toBe(0)
  })
  it('ignores an invalid preference and falls back to the system', () => {
    localStorage.setItem('learnforge:theme', 'invalid')
    systemTheme(true)
    app()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
  it('toggles with Enter and Space, persists explicit choices, and restores them on remount', async () => {
    const user = userEvent.setup(), first = app()
    const toggle = screen.getByRole('button', { name: '深色模式' })
    toggle.focus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('learnforge:theme')).toBe('dark')
    first.unmount()
    delete document.documentElement.dataset.theme
    app()
    const restored = screen.getByRole('button', { name: '深色模式' })
    expect(restored).toHaveAttribute('aria-pressed', 'true')
    restored.focus()
    await user.keyboard(' ')
    expect(restored).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('learnforge:theme')).toBe('light')
    cleanup()
    delete document.documentElement.dataset.theme
    systemTheme(true)
    app()
    expect(screen.getByRole('button', { name: '深色模式' })).toHaveAttribute('aria-pressed', 'false')
  })
  it('keeps the chosen theme across navigation and system preference changes', async () => {
    const user = userEvent.setup()
    app()
    await user.click(screen.getByRole('button', { name: '深色模式' }))
    systemTheme(false)
    await user.click(screen.getByRole('link', { name: '題庫' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('button', { name: '深色模式' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })
  it('still switches themes when the browser blocks preference storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    systemTheme(true)
    const user = userEvent.setup()
    app()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await user.click(screen.getByRole('button', { name: '深色模式' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(screen.getByRole('button', { name: '深色模式' })).toHaveAttribute('aria-pressed', 'false')
  })
  it('defaults to light if system preference detection is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    app()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})
