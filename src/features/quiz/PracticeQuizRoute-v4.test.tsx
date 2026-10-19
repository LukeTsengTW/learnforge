// @vitest-environment jsdom
import { DRAWING_LIMITS } from '../../../supabase/functions/_shared/drawing-raster'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gradeQuizV4 } from '../../lib/grading'
import type { DraftAnswerMapV4 } from '../../models/draft-v4'
import type { TrustedRubricJudgment } from '../../models/attempt'
import { ResultPage } from '../../pages/ResultPage'
import { PracticeContext } from './practice-context'
import { SubmissionError } from './practice-repository'
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
const handCanvas = () => screen.getByRole('img', { name: '第 1 頁手寫作答區' })

function renderApp(repo: ReturnType<typeof createV4MemoryRepository>['repo']) {
  return render(<PracticeContext.Provider value={repo}>
    <MemoryRouter initialEntries={[`/quiz/${v4Quiz.id}`]}><Routes>
      <Route path="/quiz/:quizId" element={<PracticeQuizRoute />} />
      <Route path="/result/:attemptId" element={<ResultPage />} />
    </Routes></MemoryRouter></PracticeContext.Provider>)
}

/** Schema-3 route fixture: deterministic/manual grading only, with no provider calls. */
function v5Submission(server: ReturnType<typeof createV4MemoryRepository>) {
  server.submitBehavior.mockImplementation(async (row, requestId) => {
    const attempt = row.record.attempt!
    if (attempt.schemaVersion !== 3 || attempt.status !== 'in-progress') throw new Error('expected a schema-3 draft')
    const answers: DraftAnswerMapV4 = {}
    for (const [questionId, answer] of Object.entries(attempt.answers)) {
      if (answer.type === 'calculation' && 'pages' in answer) {
        answers[questionId] = { type: 'calculation', mode: answer.mode, text: answer.text, strokes: answer.pages.flat() }
      } else answers[questionId] = answer
    }
    const rubric: TrustedRubricJudgment[] = ['q_text', 'q_hand', 'q_draw'].map((questionId) => {
      const question = v4Quiz.questions.find((item) => item.id === questionId)!
      return { questionId, questionType: question.type as 'calculation' | 'drawing', answerHash: 'c'.repeat(64),
        source: 'system', status: 'unanswered', score: 0, maxScore: question.points, criteria: [] }
    })
    const result = gradeQuizV4(v4Quiz, answers, [{ questionId: 'q_fill', source: 'rule', status: 'unanswered', reason: null }], rubric)
    const now = '2026-10-02T09:00:00.000Z'
    row.record.attempt = { ...attempt, status: 'submitted', submittedAt: now, result } as unknown as typeof attempt
    row.record.row = { ...row.record.row, status: 'submitted', grading_version: 'ai-grading-v5', submission_request_id: requestId,
      submitted_at: now, updated_at: now }
    row.record.version = { id: row.record.id, updatedAt: now }
    return { state: 'submitted', result }
  })
}

describe('M6 synthetic schema-3 quiz route', () => {
  it('shows the selector, keeps both buffers, autosaves schema 3 and reconstructs on reload', async () => {
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
    await waitFor(() => expect(server.v5Saves.length).toBeGreaterThan(0))
    const saved = server.v5Saves.at(-1)!.attempt.answers.q_hand
    expect(saved).toMatchObject({ type: 'calculation', mode: 'drawing', text: 'typed work' })
    expect(saved.type === 'calculation' && saved.mode === 'drawing' && 'pages' in saved ? saved.pages[0] : []).toHaveLength(1)
    expect(server.v3Saves).toHaveLength(0)
    expect(server.v4Saves).toHaveLength(0)
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
    // Valid under the historical schema-1 decoder, but beyond the v4 drawing limits (one stroke too many).
    const strokes = Array.from({ length: DRAWING_LIMITS.maxStrokes + 1 }, () => ({ tool: 'pen' as const, color: '#202b38' as const, width: 2,
      points: [{ x: 10, y: 10 }] }))
    server.serverEdit(draft.id, { ...(draft.attempt as Extract<typeof draft.attempt, { schemaVersion: 1 }>),
      answers: { q_draw: { type: 'drawing', strokes } } })
    renderApp(server.repo)
    expect(await screen.findByRole('heading', { name: '題目版本無法載入' })).toBeInTheDocument()
    expect(server.v3Saves).toHaveLength(0)
    expect(server.v4Saves).toHaveLength(0)
    expect(server.v5Saves).toHaveLength(0)
  })

  it('commits a pending stroke (no pointerup) into the schema-3 save before submission, then shows the result', async () => {
    const user = userEvent.setup()
    const server = createV4MemoryRepository('student')
    v5Submission(server)
    const order: string[] = []
    const save = server.repo.saveDraft, submitDraft = server.repo.submitDraft
    server.repo.saveDraft = async (...args) => {
      const answer = args[1].answers.q_hand
      order.push(`save:${answer?.type === 'calculation' && answer.mode === 'drawing' && 'pages' in answer ? answer.pages.flat().length : 0}`)
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
    expect(order.at(-1)).toBe('submit:ai-grading-v5')
    expect(order.filter((item) => item.startsWith('save:')).at(-1)).toBe('save:1')
    expect(order.indexOf('save:1')).toBeLessThan(order.indexOf('submit:ai-grading-v5'))
    expect(await screen.findByRole('heading', { name: '本次練習得分' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '第 1 頁手寫作答' })).toBeInTheDocument()
    expect(v4Catalog.getQuizRevision(v4Quiz.id, v4Quiz.revision)).toBe(v4Quiz)
  })
})

describe('formal submission progress', () => {
  async function pressSubmit(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText('本題作答方式')
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    await user.click(await screen.findByRole('button', { name: '仍然提交' }))
  }

  it('lists the finished and current steps while grading runs, then opens the result', async () => {
    const user = userEvent.setup()
    const server = createV4MemoryRepository('student')
    v5Submission(server)
    const finish = server.submitBehavior.getMockImplementation()!
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    server.submitBehavior.mockImplementation(async (row, requestId) => { await gate; return finish(row, requestId) })
    renderApp(server.repo)
    await pressSubmit(user)
    const card = await screen.findByRole('region', { name: '正在提交測驗' })
    await waitFor(() => expect(within(card).getByRole('status')).toHaveTextContent('步驟 3 / 4：評分作答'))
    const steps = within(card).getAllByRole('listitem')
    expect(steps).toHaveLength(4)
    expect(steps[0]).toHaveTextContent('儲存最新作答到雲端完成')
    expect(steps[1]).toHaveTextContent('確認雲端草稿為最新版本完成')
    expect(steps[2]).toHaveTextContent(/評分作答.*AI 逐題評分.*進行中$/)
    expect(steps[2]).toHaveAttribute('aria-current', 'step')
    expect(steps[3]).toHaveTextContent('讀取評分結果等待')
    expect(within(card).getByRole('progressbar', { name: '提交進度' })).toHaveAttribute('aria-valuetext', '第 3 步，共 4 步')
    expect(card).toHaveTextContent(/已經過 0:\d\d/)
    // The incomplete-answer confirmation closes once submission starts; the form stays locked.
    expect(screen.queryByRole('button', { name: '仍然提交' })).toBeNull()
    expect(screen.getByRole('button', { name: '提交測驗' })).toBeDisabled()
    release()
    expect(await screen.findByRole('heading', { name: '本次練習得分' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '正在提交測驗' })).toBeNull()
  })

  it('repeats why a submission stopped in the submit panel and focuses it, until dismissed, answered or retried', async () => {
    const user = userEvent.setup()
    const server = createV4MemoryRepository('student')
    server.submitBehavior.mockRejectedValue(new SubmissionError('unavailable'))
    renderApp(server.repo)
    await pressSubmit(user)
    const card = await screen.findByRole('region', { name: '提交未完成' })
    expect(card).toHaveTextContent('AI 評分暫時無法完成，本次作答尚未提交，請稍後再試。')
    expect(card).toHaveAccessibleDescription('AI 評分暫時無法完成，本次作答尚未提交，請稍後再試。')
    expect(card).toHaveFocus()
    expect(screen.queryByRole('region', { name: '正在提交測驗' })).toBeNull()
    expect(screen.getByRole('button', { name: '提交測驗' })).toBeEnabled()
    expect([...server.rows.values()][0].record.row.status).toBe('draft')
    await user.click(within(card).getByRole('button', { name: '知道了' }))
    expect(screen.queryByRole('region', { name: '提交未完成' })).toBeNull()
    expect(screen.getByRole('button', { name: '提交測驗' })).toHaveFocus()
    // An accepted answer clears it.
    await pressSubmit(user)
    await screen.findByRole('region', { name: '提交未完成' })
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(screen.queryByRole('region', { name: '提交未完成' })).toBeNull()
    // Pressing submit again clears it before the incomplete-answer confirmation shows.
    await pressSubmit(user)
    await screen.findByRole('region', { name: '提交未完成' })
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    expect(screen.queryByRole('region', { name: '提交未完成' })).toBeNull()
    expect(screen.getByRole('button', { name: '仍然提交' })).toBeInTheDocument()
  })
})
