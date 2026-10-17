// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter } from 'react-router-dom'
import { AppRoutes } from './App'
import { AuthContext } from './features/auth/auth-context'
import { PracticeContext } from './features/quiz/practice-context'
import { createV4MemoryRepository } from './features/quiz/practice-v4.test-helper'
import { quizCatalog } from './features/quiz/quiz-loader'

// Real bundled catalog and routes (no catalog mock): the shipped, v4-capable discrete-math/2 revision.
type Server = ReturnType<typeof createV4MemoryRepository>
function TestApp({ server }: { server: Server }) {
  return <AuthContext.Provider value={{ account: { id: 'test', username: 'student' }, loading: false, error: null, service: null, refresh: async () => {} }}>
    <PracticeContext.Provider value={server.repo}><HashRouter><AppRoutes /></HashRouter></PracticeContext.Provider>
  </AuthContext.Provider>
}
beforeEach(() => {
  localStorage.clear(); window.location.hash = '#/'
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('shipped discrete-math/2 through the real catalog', () => {
  it('opens the current revision, offers q2 handwriting and saves the first edit as schema 2', async () => {
    expect(quizCatalog.getCurrentQuiz('discrete-math')?.revision).toBe('2')
    const server = createV4MemoryRepository('test'), user = userEvent.setup()
    render(<TestApp server={server} />)
    await user.click(screen.getByRole('link', { name: '題庫' }))
    const card = screen.getByRole('heading', { name: '2025 Discrete Mathematics 期中考' }).closest('article')!
    await user.click(within(card).getByRole('link', { name: /開始練習|繼續作答/ }))
    await screen.findByRole('heading', { name: '2025 Discrete Mathematics 期中考', level: 1 })

    const [row] = [...server.rows.values()]
    expect(row.record.row).toMatchObject({ quiz_id: 'discrete-math', quiz_revision: '2', status: 'draft' })
    // The five calculation questions declare handwriting; the server draft is still marker 1 until the first save.
    const [mode] = screen.getAllByRole('group', { name: '本題作答方式' })
    expect(within(mode).getByRole('radio', { name: '打字' })).toBeChecked()
    expect(within(mode).getByRole('radio', { name: '手寫' })).not.toBeChecked()
    expect(row.schemaVersion).toBe(1)

    await user.type(screen.getAllByRole('textbox', { name: '你的推導過程' })[0], 'x = 3')
    await waitFor(() => expect(server.v4Saves.at(-1)?.attempt.answers.q2)
      .toEqual({ type: 'calculation', mode: 'text', text: 'x = 3', strokes: [] }), { timeout: 5000 })
    expect(server.v3Saves).toEqual([])
    expect(server.v4Saves.at(-1)?.attempt.schemaVersion).toBe(2)
    expect(server.rows.get(row.record.id)?.schemaVersion).toBe(2)
  })
})
