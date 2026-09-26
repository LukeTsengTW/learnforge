// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'

const { getSupabase } = vi.hoisted(() => ({
  getSupabase: vi.fn(() => { throw new Error('author route must not initialize Supabase') }),
}))
vi.mock('./lib/supabase', () => ({ getSupabase }))

import App from './App'

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.location.hash = '#/' })

it('opens the public author route without Supabase configuration or an auth session', async () => {
  window.location.hash = '#/author'
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  render(<App />)
  expect(await screen.findByRole('heading', { name: '題庫編寫工具' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '題庫編寫' })).toHaveAttribute('href', '#/author')
  expect(getSupabase).not.toHaveBeenCalled()
})
