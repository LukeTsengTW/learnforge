// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import { gradeQuizV4 } from '../../lib/grading'
import { STROKE_SAMPLE_MAX_SEGMENT } from '../../lib/stroke-sampling'
import type { QuizAttempt, TrustedRubricJudgment } from '../../models/attempt'
import type { DrawingStroke } from '../../models/drawing'
import { ResultPage } from '../../pages/ResultPage'
import { PracticeContext } from './practice-context'
import { DRAWING_LIMITS } from '../../../supabase/functions/_shared/drawing-raster'
import { DRAWING_LIMIT_NOTICES } from './DrawingCanvas'
import { PracticeQuizRoute } from './PracticeQuizRoute'
import { SubmissionError } from './practice-repository'
import { createV4MemoryRepository, v4Catalog, v4Quiz } from './practice-v4.test-helper'

/**
 * Submit-boundary contract for handwriting, driven through the real route:
 * DrawingCanvas -> calculation answer -> practice store -> draft save -> formal submission.
 * The server submits its own persisted draft (the browser sends only ids and the CAS), so the
 * submitted drawing is read from the server record and compared with what the canvas showed.
 */
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

type Server = ReturnType<typeof createV4MemoryRepository>
// The stored-answer limits under test; the scenarios start one stroke, or one hundred points, below them.
const MAX_STROKES = DRAWING_LIMITS.maxStrokes, MAX_POINTS = DRAWING_LIMITS.maxPoints
// Strokes drawn by the most recent canvas replay: beginPath calls since the last clearRect.
let painted = 0
// The same count kept per canvas, for reading one canvas while another (q_draw) has replayed since.
let paintedOn = new WeakMap<HTMLCanvasElement, number>()
beforeEach(() => {
  holder.catalog = v4Catalog
  localStorage.clear()
  painted = 0
  paintedOn = new WeakMap()
  // Plain functions: recording mocks would keep millions of calls for long drawings.
  const noop = () => undefined
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { save: noop, restore: noop, clearRect: () => { painted = 0; paintedOn.set(this, 0) },
      beginPath: () => { painted++; paintedOn.set(this, (paintedOn.get(this) ?? 0) + 1) }, arc: noop, fill: noop, moveTo: noop,
      lineTo: noop, stroke: noop } as unknown as CanvasRenderingContext2D
  })
  // The display rect equals the logical size of q_hand, so client coordinates are logical coordinates.
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture: () => undefined, hasPointerCapture: () => false,
    releasePointerCapture: () => undefined })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: 9 }, isPrimary: { value: true } })
  fireEvent(handCanvas(), event)
}
const handCanvas = () => document.querySelector('canvas[aria-describedby="answer-q_hand-drawing-instructions"]')!
/**
 * One completed pen gesture on its own row; returns the stroke the canvas must hold for it.
 * The moves zigzag by four units, so none of them is within the stroke sampler's tolerance of its
 * neighbours and every sample is stored.
 */
function draw(row: number, moves = 0): DrawingStroke {
  const y = 10 + (row % 500)
  const points = [{ x: 10, y }]
  pointer('pointerdown', 10, y)
  for (let step = 0; step < moves; step++) {
    const x = 20 + (step % 700), zigzag = y + (step % 2) * 4
    pointer('pointermove', x, zigzag)
    points.push({ x, y: zigzag })
  }
  pointer('pointerup', 760, y)
  points.push({ x: 760, y })
  return { tool: 'pen', color: '#202b38', width: 4, points }
}
function renderApp(server: Server, result = <ResultPage />) {
  return render(<PracticeContext.Provider value={server.repo}>
    <MemoryRouter initialEntries={[`/quiz/${v4Quiz.id}`]}><Routes>
      <Route path="/quiz/:quizId" element={<PracticeQuizRoute />} />
      <Route path="/result/:attemptId" element={result} />
    </Routes></MemoryRouter></PracticeContext.Provider>)
}
/** Finalizes the server's own persisted draft, as submit-quiz does (system evidence only, no provider). */
function finalizing(server: Server) {
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
  return server
}
const serverRow = (server: Server) => [...server.rows.values()][0]
function handAnswer(attempt: { answers: Record<string, unknown> } | null | undefined) {
  return attempt?.answers.q_hand as { mode: string; text: string; strokes: DrawingStroke[] } | undefined
}
const pointCount = (strokes: DrawingStroke[]) => strokes.reduce((sum, item) => sum + item.points.length, 0)
async function startHandwriting(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('radio', { name: '手寫' }))
}
/** Presses the submit button and confirms the incomplete-objective warning (q_single and q_fill stay unanswered). */
async function pressSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '提交測驗' }))
  await user.click(await screen.findByRole('button', { name: '仍然提交' }))
}
const submitted = (server: Server) => waitFor(() => expect(serverRow(server).record.row.status).toBe('submitted'), { timeout: 4000 })
/** A stroke as an earlier session would have saved it: on its own row, with the given number of points. */
const savedStroke = (row: number, points = 2): DrawingStroke => ({ tool: 'pen', color: '#202b38', width: 4,
  points: Array.from({ length: points }, (_, step) => ({ x: 10 + step * 7, y: 10 + (row % 500) })) })
/**
 * Puts a schema-2 draft with handwriting for q_hand on the server before the page loads, so a test can
 * start just below a stored-drawing limit. The strokes at the limit are still drawn with pointer events.
 */
async function seedHandwriting(server: Server, strokes: DrawingStroke[]) {
  const draft = await server.repo.getOrCreateDraft(v4Quiz)
  const promoted = upgradeLegacyQuizDraftV4(draft.attempt as QuizAttempt, v4Quiz)!
  server.serverEdit(draft.id, { ...promoted, updatedAt: '2026-10-02T00:30:00.000Z',
    answers: { q_hand: { type: 'calculation', mode: 'drawing', text: '', strokes } } })
  return strokes
}
/** Waits for the page to restore the seeded handwriting and returns once the q_hand canvas shows that many strokes. */
async function restoredHandwriting(count: number) {
  expect(await screen.findByRole('radio', { name: '手寫' })).toBeChecked()
  await waitFor(() => expect(paintedOn.get(handCanvas() as HTMLCanvasElement)).toBe(count))
}
/** Local recovery copies written because a draft was treated as stale against another client's save. */
const staleRecoveryEntries = () => Object.keys(localStorage).filter((key) => key.includes(':recovery:')
  && localStorage.getItem(key)!.includes('此本機版本未自動套用'))
const handTools = () => within(handCanvas().closest('.drawing-editor') as HTMLElement)

describe('submit boundary: the submitted drawing is the completed drawing on the canvas', () => {
  it('immediate submit after the last stroke, before any autosave ran, submits all three strokes', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    renderApp(server)
    await startHandwriting(user)
    const drawn = [draw(0, 2), draw(60, 2), draw(120, 2)]
    expect(painted).toBe(3)
    // The 800 ms autosave has not fired: the server still holds no draft answers (draft and formal
    // submission are separate contracts; an unsynchronized draft must not make the submission stale).
    expect(server.v4Saves).toHaveLength(0)
    await pressSubmit(user)
    await submitted(server)
    expect(server.submits).toHaveLength(1)
    // The CAS that was submitted is the generation of the save that carried the three strokes.
    expect(handAnswer(server.v4Saves.at(-1)!.attempt)!.strokes).toEqual(drawn)
    expect(handAnswer(serverRow(server).record.attempt)).toEqual({ type: 'calculation', mode: 'drawing', text: '', strokes: drawn })
    // The result view reconstructs the same three strokes.
    expect(await screen.findByRole('img', { name: '已提交的繪圖答案' })).toBeInTheDocument()
    expect(painted).toBe(3)
  })

  it('forty rapid strokes followed by an immediate submit lose no stroke and no point', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    renderApp(server)
    await startHandwriting(user)
    const drawn = Array.from({ length: 40 }, (_, index) => draw(index * 7, index % 5))
    expect(painted).toBe(40)
    await pressSubmit(user)
    await submitted(server)
    const answer = handAnswer(serverRow(server).record.attempt)!
    expect(answer.strokes).toHaveLength(40)
    expect(pointCount(answer.strokes)).toBe(pointCount(drawn))
    expect(answer.strokes).toEqual(drawn)
  })

  it('a slow draft save in flight when the last stroke is drawn: the newest drawing is saved and submitted', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    const save = server.repo.saveDraft
    let release: (() => void) | null = null
    let first = true
    server.repo.saveDraft = async (...args) => {
      if (first) { first = false; await new Promise<void>((resolve) => { release = resolve }) }
      return save(...args)
    }
    renderApp(server)
    await startHandwriting(user)
    const early = [draw(0), draw(60)]
    await user.click(screen.getByRole('button', { name: '重試同步' }))
    await waitFor(() => expect(release).not.toBeNull())
    const last = draw(120) // drawn while the save of the first two strokes is still in flight
    await pressSubmit(user)
    expect(server.submits).toHaveLength(0)
    release!() // the older save completes only now
    await submitted(server)
    // The older completion did not roll the draft back: a second save carried the newer drawing.
    expect(server.v4Saves.map((item) => handAnswer(item.attempt)!.strokes.length)).toEqual([2, 3])
    expect(handAnswer(serverRow(server).record.attempt)!.strokes).toEqual([...early, last])
  })

  it('a draft save the server applied but whose response was lost does not roll the canvas or the submission back', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    const save = server.repo.saveDraft
    let first = true
    server.repo.saveDraft = async (...args) => {
      const saved = await save(...args)
      if (first) { first = false; throw new Error('network: response lost') }
      return saved
    }
    renderApp(server)
    await startHandwriting(user)
    const early = [draw(0), draw(60)]
    await user.click(screen.getByRole('button', { name: '重試同步' }))
    await waitFor(() => expect(server.v4Saves).toHaveLength(1))
    const last = draw(120)
    expect(painted).toBe(3)
    await pressSubmit(user)
    await submitted(server)
    expect(handAnswer(serverRow(server).record.attempt)!.strokes).toEqual([...early, last])
    // The store recognized its own generation: the newer local work was not set aside as a stale draft.
    expect(staleRecoveryEntries()).toHaveLength(0)
    expect(server.submits).toHaveLength(1)
  })

  it('handwriting -> typing -> handwriting keeps the drawing buffer and submits a stroke added afterwards', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    renderApp(server)
    await startHandwriting(user)
    const early = [draw(0), draw(60)]
    await user.click(screen.getByRole('radio', { name: '打字' }))
    await user.type(document.getElementById('answer-q_hand-text')!, 'typed note')
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(painted).toBe(2)
    const last = draw(120)
    await pressSubmit(user)
    await submitted(server)
    expect(handAnswer(serverRow(server).record.attempt)).toEqual(
      { type: 'calculation', mode: 'drawing', text: 'typed note', strokes: [...early, last] })
  })

  it('the typed path is unchanged: active text is submitted and an earlier drawing stays in its inactive buffer', async () => {
    const user = userEvent.setup()
    // The helper's default submission only marks the server's own draft as submitted (typed answers
    // would need AI judgments to compose a v4 result), so the result view is not rendered here; the
    // persisted answers are what is checked.
    const server = createV4MemoryRepository('student')
    renderApp(server, <p>submitted</p>)
    await startHandwriting(user)
    const kept = [draw(0)]
    await user.click(screen.getByRole('radio', { name: '打字' }))
    await user.type(document.getElementById('answer-q_hand-text')!, 'x = 3')
    await user.type(document.getElementById('answer-q_text-text')!, 'x = 2')
    await pressSubmit(user)
    await submitted(server)
    const answers = serverRow(server).record.attempt!.answers
    expect(answers.q_hand).toEqual({ type: 'calculation', mode: 'text', text: 'x = 3', strokes: kept })
    expect(answers.q_text).toEqual({ type: 'calculation', mode: 'text', text: 'x = 2', strokes: [] })
  })

  it('a gesture still in progress at submit is completed and submitted; later events of that pointer add nothing', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    const submitDraft = server.repo.submitDraft
    let release: (() => void) | null = null
    server.repo.submitDraft = async (...args) => { await new Promise<void>((resolve) => { release = resolve }); return submitDraft(...args) }
    renderApp(server)
    await startHandwriting(user)
    const first = draw(0)
    pointer('pointerdown', 100, 300); pointer('pointermove', 400, 320)
    await pressSubmit(user)
    await waitFor(() => expect(release).not.toBeNull())
    // The pen is still down while the submission is in flight: these events belong to the gesture
    // that was already completed at the boundary, and a new contact is not taken either.
    pointer('pointermove', 600, 500); pointer('pointerup', 700, 550)
    pointer('pointerdown', 50, 50); pointer('pointerup', 90, 90)
    expect(painted).toBe(2)
    release!()
    await submitted(server)
    expect(handAnswer(serverRow(server).record.attempt)!.strokes).toEqual([first,
      { tool: 'pen', color: '#202b38', width: 4, points: [{ x: 100, y: 300 }, { x: 400, y: 320 }] }])
  })
})

describe('the canvas never shows ink the answer did not accept', () => {
  it('refuses the stroke past the stroke limit visibly, keeps the accepted ones, and submits exactly what is shown', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    // One stroke below the limit is already in the draft; the strokes at the limit are drawn on the page.
    const saved = await seedHandwriting(server, Array.from({ length: MAX_STROKES - 1 }, (_, index) => savedStroke(index)))
    renderApp(server)
    await restoredHandwriting(MAX_STROKES - 1)
    draw(300)
    expect(painted).toBe(MAX_STROKES)
    expect(screen.queryByText(/儲存上限/)).toBeNull()
    draw(310)
    // Only the new stroke is refused; nothing that was accepted disappears.
    expect(painted).toBe(MAX_STROKES)
    expect(screen.getByRole('alert')).toHaveTextContent(DRAWING_LIMIT_NOTICES.strokes)
    expect(screen.getByRole('alert')).toHaveTextContent(`筆數的儲存上限（最多 ${MAX_STROKES.toLocaleString('en-US')} 筆）`)
    // Undo frees one stroke: the notice goes away and a new stroke is accepted again.
    await user.click(handTools().getByRole('button', { name: '復原' }))
    expect(screen.queryByText(/儲存上限/)).toBeNull()
    expect(painted).toBe(MAX_STROKES - 1)
    const replacement = draw(400)
    expect(painted).toBe(MAX_STROKES)
    await pressSubmit(user)
    await submitted(server)
    expect(handAnswer(serverRow(server).record.attempt)!.strokes).toEqual([...saved, replacement])
  })

  it('refuses the stroke that would pass the point limit, and submits the strokes that are shown', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    // Strokes of 100 points are already in the draft, 100 points below the limit.
    const seeded = MAX_POINTS / 100 - 1
    const saved = await seedHandwriting(server, Array.from({ length: seeded }, (_, index) => savedStroke(index, 100)))
    renderApp(server)
    await restoredHandwriting(seeded)
    const last = draw(150, 98) // 100 more points: exactly the limit
    expect(painted).toBe(seeded + 1)
    expect(screen.queryByText(/儲存上限/)).toBeNull()
    draw(200, 98)
    expect(painted).toBe(seeded + 1)
    expect(screen.getByRole('alert')).toHaveTextContent(DRAWING_LIMIT_NOTICES.points)
    expect(screen.getByRole('alert')).toHaveTextContent(`取樣點的儲存上限（最多 ${MAX_POINTS.toLocaleString('en-US')} 個取樣點）`)
    // A short stroke is not possible either: the draft already holds exactly the limit.
    draw(210)
    expect(painted).toBe(seeded + 1)
    await pressSubmit(user)
    await submitted(server)
    const answer = handAnswer(serverRow(server).record.attempt)!
    expect(pointCount(answer.strokes)).toBe(MAX_POINTS)
    expect(answer.strokes).toEqual([...saved, last])
  })

  it('stores a long, densely sampled stroke within the point limit and submits it as shown', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    // The draft is 100 points below the limit: only 100 more can be stored.
    const seeded = MAX_POINTS / 100 - 1
    const saved = await seedHandwriting(server, Array.from({ length: seeded }, (_, index) => savedStroke(index, 100)))
    renderApp(server)
    await restoredHandwriting(seeded)
    // One straight stroke with a sample every unit: 301 pointer samples, three times what is left.
    pointer('pointerdown', 10, 150)
    for (let x = 11; x < 310; x++) pointer('pointermove', x, 150)
    pointer('pointerup', 310, 150)
    expect(painted).toBe(seeded + 1)
    expect(screen.queryByText(/儲存上限/)).toBeNull()
    await pressSubmit(user)
    await submitted(server)
    const answer = handAnswer(serverRow(server).record.attempt)!
    expect(answer.strokes.slice(0, seeded)).toEqual(saved)
    const shown = answer.strokes[seeded].points
    expect(shown[0]).toEqual({ x: 10, y: 150 })
    expect(shown.at(-1)).toEqual({ x: 310, y: 150 })
    expect(shown).toHaveLength(Math.ceil(300 / STROKE_SAMPLE_MAX_SEGMENT) + 1)
    expect(shown.every((point) => point.y === 150)).toBe(true)
    expect(pointCount(answer.strokes)).toBeLessThanOrEqual(MAX_POINTS)
    // The save that the submission was bound to carried the same strokes.
    expect(handAnswer(server.v4Saves.at(-1)!.attempt)!.strokes).toEqual(answer.strokes)
  })

  it('takes no ink while a submission is in flight; after that submission fails the canvas and the next submission agree', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    const submitDraft = server.repo.submitDraft
    let fail: (() => void) | null = null
    let first = true
    server.repo.submitDraft = async (...args) => {
      if (first) { first = false; await new Promise<void>((resolve) => { fail = resolve }); throw new SubmissionError('unavailable') }
      return submitDraft(...args)
    }
    renderApp(server)
    await startHandwriting(user)
    const drawn = [draw(0), draw(60)]
    await pressSubmit(user)
    await waitFor(() => expect(fail).not.toBeNull())
    draw(120) // attempted while the form is locked for submission
    expect(painted).toBe(2)
    fail!()
    expect(await screen.findByText(/本次作答尚未提交/)).toBeInTheDocument()
    expect(painted).toBe(2)
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    await user.click(await screen.findByRole('button', { name: '仍然提交' }))
    await submitted(server)
    expect(handAnswer(serverRow(server).record.attempt)!.strokes).toEqual(drawn)
  })

  it('stops the submission when the gesture in progress is refused, and says why', async () => {
    const user = userEvent.setup()
    const server = finalizing(createV4MemoryRepository('student'))
    await seedHandwriting(server, Array.from({ length: MAX_STROKES - 1 }, (_, index) => savedStroke(index)))
    renderApp(server)
    await restoredHandwriting(MAX_STROKES - 1)
    draw(300) // the last stroke the limit allows is accepted
    expect(painted).toBe(MAX_STROKES)
    pointer('pointerdown', 100, 550); pointer('pointermove', 400, 560) // one stroke too many, not released
    expect(painted).toBe(MAX_STROKES + 1)
    await pressSubmit(user)
    // The pending stroke was completed at the boundary and refused: nothing was saved for submission or submitted.
    // The reason is in the page notice and repeated in the submit panel's 提交未完成 card.
    expect(await screen.findAllByText(/尚未完成的那一筆手寫沒有加入作答/)).toHaveLength(2)
    expect(screen.getByRole('region', { name: '提交未完成' })).toHaveTextContent(/尚未完成的那一筆手寫沒有加入作答/)
    expect(screen.getByText(/儲存上限/)).toBeInTheDocument()
    expect(painted).toBe(MAX_STROKES)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(server.submits).toHaveLength(0)
    expect(serverRow(server).record.row.status).toBe('draft')
    // After the user makes room, the same submission goes through with what is on the canvas.
    await user.click(handTools().getByRole('button', { name: '復原' }))
    expect(screen.queryByText(/尚未完成的那一筆手寫沒有加入作答/)).toBeNull()
    await pressSubmit(user)
    await submitted(server)
    expect(handAnswer(serverRow(server).record.attempt)!.strokes).toHaveLength(MAX_STROKES - 1)
  })
})
