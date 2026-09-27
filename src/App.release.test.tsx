// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { getSupabase } from './lib/supabase'

vi.mock('./lib/supabase', () => ({ getSupabase: vi.fn(() => ({ error: null, client: {
  from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
} })) }))
vi.mock('./features/auth/auth-service', async importOriginal => ({
  ...await importOriginal<typeof import('./features/auth/auth-service')>(),
  createAuthService: () => ({ restore: async () => ({ id: 'release-user', username: 'release_user' }), subscribe: () => () => {} }),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('keeps a direct author visit independent of Supabase', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/author'; render(<App />)
  await screen.findByRole('heading', { name: '題庫編寫工具' })
  expect(getSupabase).not.toHaveBeenCalled()
})
it('retains the authenticated repository while navigating into author', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.location.hash = '#/library'; render(<App />)
  await screen.findByRole('link', { name: 'release_user' })
  await userEvent.click(screen.getByRole('link', { name: '題庫編寫' }))
  await screen.findByRole('heading', { name: '題庫編寫工具' })
  expect(screen.getByRole('link', { name: 'release_user' })).toBeInTheDocument()
})
