// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gradeQuizV4 } from '../../lib/grading'
import type { TrustedRubricJudgment } from '../../models/attempt'
import { ResultPage } from '../../pages/ResultPage'
import { PracticeContext } from './practice-context'
import { PracticeQuizRoute } from './PracticeQuizRoute'
import { createV4MemoryRepository, v4Catalog, v4Quiz } from './practice-v4.test-helper'

// Delegate the bundled catalog to the synthetic one without a circular import inside the mock factory.
const holder = vi.hoisted(() => ({ catalog: null as null | import('./quiz-loader').QuizCatalog }))
vi.mock('./quiz-loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./quiz-loader')>()
  return { ...actual, quizCatalog: { get current() { return holder.catalog?.current ?? [] }, errors: [],
    getCurrentQuiz: (id: string) => holder.catalog?.getCurrentQuiz(id) ?? null,
    getQuizRevision: (id: string, revision: string) => holder.catalog?.getQuizRevision(id, revision) ?? null } }
})
vi.mock('../auth/auth-context', () => ({ useAuth: () => ({ account: { id: 'student' } }) }))
vi.mock('../ai/use-ai-tutor', () => ({ useAiTutor: () => ({}) }))
vi.mock('../ai/AiTutorControls', () => ({ AiTutorControls: () => null, AiQuotaStatus: () => null }))

beforeEach(() => {
  holder.catalog = v4Catalog
  localStorage.clear()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
  // jsdom has no pointer capture API.
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture: () => undefined, hasPointerCapture: () => false,
    releasePointerCapture: () => undefined })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function pointer(element: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: 9 }, isPrimary: { value: true } })
  fireEvent(element, event)
}
const handCanvas = () => document.querySelector('canvas[aria-describedby="answer-q_hand-drawing-instructions"]')!

function renderApp(repo: ReturnType<typeof createV4MemoryRepository>['repo']) {
  return render(<PracticeContext.Provider value={repo}>
    <MemoryRouter initialEntries={[`/quiz/${v4Quiz.id}`]}><Routes>
      <Route path="/quiz/:quizId" element={<PracticeQuizRoute />} />
      <Route path="/result/:attemptId" element={<ResultPage />} />
    </Routes></MemoryRouter></PracticeContext.Provider>)
}

/** Server-side v4 composition for the fake: system evidence only (no provider), as a finalized v4 result. */
function v4Submission(server: ReturnType<typeof createV4MemoryRepository>) {
  server.submitBehavior.mockImplementation(async (row, requestId) => {
    const attempt = row.record.attempt!
    if (attempt.schemaVersion !== 2 || attempt.status !== 'in-progress') throw new Error('expected a v4 draft')
    const rubric: TrustedRubricJudgment[] = ['q_text', 'q_hand', 'q_draw'].map((questionId) => {
      const question = v4Quiz.questions.find((item) => item.id === questionId)!
      return { questionId, questionType: question.type as 'calculation' | 'drawing', answerHash: 'c'.repeat(64),
        source: 'system', status: 'unanswered', score: 0, maxScore: question.points, criteria: [] }
    })
    const result = gradeQuizV4(v4Quiz, attempt.answers, [{ questionId: 'q_fill', source: 'rule', status: 'unanswered', reason: null }], rubric)
    const now = '2026-10-02T09:00:00.000Z'
    row.record.attempt = { ...attempt, status: 'submitted', submittedAt: now, result }
    row.record.row = { ...row.record.row, status: 'submitted', grading_version: 'ai-grading-v4', submission_request_id: requestId,
      submitted_at: now, updated_at: now }
    row.record.version = { id: row.record.id, updatedAt: now }
    return { state: 'submitted', result }
  })
}

describe('M5 synthetic v4-capable quiz route', () => {
  it('shows the selector, keeps both buffers, autosaves schema 2 and reconstructs on reload', async () => {
    const user = userEvent.setup()
    const server = createV4MemoryRepository('student')
    const view = renderApp(server.repo)
    expect(await screen.findByText('本題作答方式')).toBeInTheDocument()
    // Only the capable calculation has a selector; the text-only calculation does not.
    expect(screen.getAllByRole('radio', { name: '手寫' })).toHaveLength(1)
    await user.type(document.getElementById('answer-q_hand-text')!, 'typed work')
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    pointer(handCanvas(), 'pointerdown', 100, 100); pointer(handCanvas(), 'pointermove', 300, 200); pointer(handCanvas(), 'pointerup', 320, 220)
    await user.click(screen.getByRole('button', { name: '重試同步' }))
    await waitFor(() => expect(server.v4Saves.length).toBeGreaterThan(0))
    const saved = server.v4Saves.at(-1)!.attempt.answers.q_hand
    expect(saved).toMatchObject({ type: 'calculation', mode: 'drawing', text: 'typed work' })
    expect(saved.type === 'calculation' && saved.mode === 'drawing' ? saved.strokes : []).toHaveLength(1)
    expect(server.v3Saves).toHaveLength(0)
    view.unmount()
    localStorage.clear()
    renderApp(server.repo)
    expect(await screen.findByRole('radio', { name: '手寫' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: '打字' }))
    expect(document.getElementById('answer-q_hand-text')).toHaveValue('typed work')
  })

  it('surfaces a compatibility error (never repairs or downgrades) when a schema-1 draft cannot be promoted', async () => {
    const server = createV4MemoryRepository('student')
    const draft = await server.repo.getOrCreateDraft(v4Quiz)
    // Valid under the historical schema-1 decoder, but beyond the v4 drawing limits (max 256 strokes).
    const strokes = Array.from({ length: 300 }, () => ({ tool: 'pen' as const, color: '#202b38' as const, width: 2,
      points: [{ x: 10, y: 10 }] }))
    server.serverEdit(draft.id, { ...(draft.attempt as Extract<typeof draft.attempt, { schemaVersion: 1 }>),
      answers: { q_draw: { type: 'drawing', strokes } } })
    renderApp(server.repo)
    expect(await screen.findByRole('heading', { name: '題目版本無法載入' })).toBeInTheDocument()
    expect(server.v3Saves).toHaveLength(0)
    expect(server.v4Saves).toHaveLength(0)
  })

  it('commits a pending stroke (no pointerup) into the v4 save before formal submission, then shows the v4 result', async () => {
    const user = userEvent.setup()
    const server = createV4MemoryRepository('student')
    v4Submission(server)
    const order: string[] = []
    const save = server.repo.saveDraft, submitDraft = server.repo.submitDraft
    server.repo.saveDraft = async (...args) => {
      const answer = args[1].answers.q_hand
      order.push(`save:${answer?.type === 'calculation' && answer.mode === 'drawing' ? answer.strokes.length : 0}`)
      return save(...args)
    }
    server.repo.submitDraft = async (...args) => { order.push(`submit:${args[3]}`); return submitDraft(...args) }
    renderApp(server.repo)
    await user.click(await screen.findByRole('radio', { name: '手寫' }))
    pointer(handCanvas(), 'pointerdown', 100, 100); pointer(handCanvas(), 'pointermove', 400, 300)
    // No pointerup: the stroke exists only in the editor when submission starts.
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    await user.click(await screen.findByRole('button', { name: '仍然提交' }))
    await waitFor(() => expect(order.some((item) => item.startsWith('submit:'))).toBe(true))
    expect(order.at(-1)).toBe('submit:ai-grading-v4')
    expect(order.filter((item) => item.startsWith('save:')).at(-1)).toBe('save:1')
    expect(order.indexOf('save:1')).toBeLessThan(order.indexOf('submit:ai-grading-v4'))
    expect(await screen.findByRole('heading', { name: '本次練習得分' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '已提交的繪圖答案' })).toBeInTheDocument()
    expect(v4Catalog.getQuizRevision(v4Quiz.id, v4Quiz.revision)).toBe(v4Quiz)
  })
})
