import { describe, expect, it, vi } from 'vitest'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { featureAllowed, normalizeStudentAnswer, type TutorQuestionContext } from '../../../supabase/functions/_shared/ai-tutor'
import { GradingAnswerError, normalizeGradingAnswer } from '../../../supabase/functions/_shared/calculation-grading'
import { createGradingHandler, type GradingBackend } from '../../../supabase/functions/ai-grade/handler'
import { createTutorHandler, type TutorBackend } from '../../../supabase/functions/ai-tutor/handler'

const contexts = AI_QUIZ_CONTEXT as unknown as TutorQuestionContext[]
const calculation = contexts.find((item) => item.type === 'calculation')!
const userId = crypto.randomUUID()
const attemptId = crypto.randomUUID()
const INACTIVE = 'inactive typed text that is not the answer'
const handwritten = { type: 'calculation', mode: 'drawing', text: INACTIVE, strokes: [{ tool: 'pen', color: '#202b38', width: 4,
  points: [{ x: 1, y: 1 }] }] }
const typedV4 = { type: 'calculation', mode: 'text', text: 'x = 3', strokes: [] }
const http = (path: string, body: unknown) => new Request(`https://example.test/${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

function gradingBackend(answer: unknown, status = 'submitted') {
  const provider = { generate: vi.fn() }
  const backend: GradingBackend = { userId, provider,
    loadAttempt: vi.fn(async () => ({ id: attemptId, user_id: userId, quiz_id: calculation.quizId,
      quiz_revision: calculation.revision, status })),
    loadAnswer: vi.fn(async () => answer), findRequest: vi.fn(async () => ({ state: 'missing' })),
    reserve: vi.fn(async () => ({ state: 'created' })), complete: vi.fn(async () => true), refund: vi.fn(async () => undefined) }
  return { backend, provider }
}
function tutorBackend(answer: unknown, status: string) {
  const provider = { generate: vi.fn() }
  const backend: TutorBackend = { userId, provider,
    loadAttempt: vi.fn(async () => ({ id: attemptId, user_id: userId, quiz_id: calculation.quizId,
      quiz_revision: calculation.revision, status })),
    loadAnswer: vi.fn(async () => answer), findRequest: vi.fn(async () => ({ state: 'missing' })),
    reserve: vi.fn(async () => ({ state: 'denied' })), complete: vi.fn(async () => true), refund: vi.fn(async () => undefined) }
  return { backend, provider }
}

describe('M5 personal advisory readers never treat handwriting as its inactive text', () => {
  it('ai-grade accepts only the active text of a v4 answer and rejects handwriting', () => {
    expect(normalizeGradingAnswer(typedV4)).toBe('x = 3')
    expect(normalizeGradingAnswer({ type: 'calculation', text: 'legacy' })).toBe('legacy')
    for (const bad of [handwritten, { ...typedV4, score: 6 }, { type: 'calculation', mode: 'text', text: 'x' }]) {
      expect(() => normalizeGradingAnswer(bad)).toThrow(GradingAnswerError)
    }
  })

  it('ai-grade rejects a handwritten calculation before any personal quota reservation', async () => {
    const { backend, provider } = gradingBackend(handwritten)
    const response = await createGradingHandler(backend)(http('ai-grade', { requestId: crypto.randomUUID(),
      feature: 'calculation_grading', attemptId, questionId: calculation.questionId }))
    expect(response.status).toBe(409)
    expect(backend.reserve).not.toHaveBeenCalled()
    expect(provider.generate).not.toHaveBeenCalled()
  })

  it('ai-tutor represents handwriting without text and refuses hint/mistake help before reservation', async () => {
    expect(normalizeStudentAnswer(calculation, handwritten)).toEqual({ type: 'calculation', mode: 'drawing' })
    expect(normalizeStudentAnswer(calculation, typedV4)).toEqual({ type: 'calculation', text: 'x = 3' })
    expect(() => normalizeStudentAnswer(calculation, { ...handwritten, extra: true })).toThrow()
    const drawingAnswer = normalizeStudentAnswer(calculation, handwritten)
    expect(featureAllowed('hint', 'draft', calculation, drawingAnswer)).toBe(false)
    expect(featureAllowed('explain_mistake', 'submitted', calculation, drawingAnswer)).toBe(false)
    expect(featureAllowed('explain_solution', 'submitted', calculation, drawingAnswer)).toBe(true)
    const { backend, provider } = tutorBackend(handwritten, 'draft')
    const response = await createTutorHandler(backend)(http('ai-tutor', { requestId: crypto.randomUUID(),
      feature: 'hint', attemptId, questionId: calculation.questionId }))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('feature_unavailable')
    expect(backend.reserve).not.toHaveBeenCalled()
    expect(provider.generate).not.toHaveBeenCalled()
  })

  it('keeps canonical-only explain_solution available for a handwritten answer (no student answer is sent)', async () => {
    const { backend } = tutorBackend(handwritten, 'submitted')
    const response = await createTutorHandler(backend)(http('ai-tutor', { requestId: crypto.randomUUID(),
      feature: 'explain_solution', attemptId, questionId: calculation.questionId }))
    // The reservation is reached (it is denied by this fake ledger), proving the feature itself is allowed.
    expect(backend.reserve).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(429)
  })
})
