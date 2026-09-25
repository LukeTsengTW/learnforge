import { describe, expect, it, vi } from 'vitest'
import { createAiResponsesHandler, type StoredAiRow } from '../../../supabase/functions/ai-responses/handler'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import type { TutorQuestionContext } from '../../../supabase/functions/_shared/ai-tutor'
import { validateGradingResult } from '../../../supabase/functions/_shared/calculation-grading'

const attemptId = '11111111-1111-4111-8111-111111111111'
const output = { title: '提示', message: '先整理條件。', keyPoints: [], nextStep: null }
const row = (feature: string, questionId = 'q1'): StoredAiRow => ({
  question_id: questionId, feature, response: output, completed_at: '2026-09-25T10:00:00Z', pending: false,
})
const calculation = (AI_QUIZ_CONTEXT as unknown as TutorQuestionContext[]).find((item) => item.type === 'calculation')!
const grading = validateGradingResult({ overallScore: 0, maxScore: 6,
  criteria: [1, 2, 3].map((n) => ({ criterionId: `r${n}`, awardedScore: 0, maxScore: 2,
    status: 'none', feedback: '未提供證據。' })), summary: '尚未展示推導。', strengths: [], improvements: [],
  confidence: 'low', requiresManualReview: true }, calculation)!

describe('AI response read boundary', () => {
  it('checks owned attempt before reading ledger and gives the same 404 for unknown attempts', async () => {
    const loadResponses = vi.fn().mockResolvedValue([row('hint')])
    const handler = createAiResponsesHandler({ ownsAttempt: vi.fn().mockResolvedValue(false), loadResponses })
    const foreign = await handler(new Request(`https://example.test/ai-responses?attemptId=${attemptId}`))
    const invalid = await handler(new Request('https://example.test/ai-responses?attemptId=invalid'))
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual(await invalid.json())
    expect(loadResponses).not.toHaveBeenCalled()
  })

  it('projects completed content by question and feature plus a content-free pending signal', async () => {
    const rows = [row('hint'), row('explain_mistake'), row('explain_solution', 'q2'),
      { ...row('hint', 'q3'), pending: true, response: null, completed_at: null },
      { ...row('hint', 'q4'), response: { ...output, provider_response_id: 'private' } }]
    const handler = createAiResponsesHandler({ ownsAttempt: vi.fn().mockResolvedValue(true),
      loadResponses: vi.fn().mockResolvedValue(rows) })
    const response = await handler(new Request(`https://example.test/ai-responses?attemptId=${attemptId}`))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.responses).toEqual([
      { questionId: 'q1', feature: 'hint', response: output, completedAt: '2026-09-25T10:00:00Z' },
      { questionId: 'q1', feature: 'explain_mistake', response: output, completedAt: '2026-09-25T10:00:00Z' },
      { questionId: 'q2', feature: 'explain_solution', response: output, completedAt: '2026-09-25T10:00:00Z' },
    ])
    expect(body.pending).toEqual([{ questionId: 'q3', feature: 'hint' }])
    expect(JSON.stringify(body)).not.toContain('provider_response_id')
  })

  it('is read only and does not call a provider or quota reservation', async () => {
    const backend = { ownsAttempt: vi.fn().mockResolvedValue(true), loadResponses: vi.fn().mockResolvedValue([]) }
    const response = await createAiResponsesHandler(backend)(new Request(`https://example.test/ai-responses?attemptId=${attemptId}`))
    expect(response.status).toBe(200)
    expect(backend.loadResponses).toHaveBeenCalledWith(attemptId)
    expect(Object.keys(backend)).toEqual(['ownsAttempt', 'loadResponses'])
  })
  it('restores only canonical validated calculation results and keeps refusal scoreless', async () => {
    const rows = [
      { ...row('calculation_grading', calculation.questionId), response: grading },
      { ...row('calculation_grading', 'bad-question'), response: grading },
      { ...row('calculation_grading', calculation.questionId), response: { ...grading, overallScore: 6 } },
    ]
    const handler = createAiResponsesHandler({ ownsAttempt: vi.fn().mockResolvedValue({
      quizId: calculation.quizId, revision: calculation.revision, status: 'submitted',
    }), loadResponses: vi.fn().mockResolvedValue(rows) })
    const response = await handler(new Request(`https://example.test/ai-responses?attemptId=${attemptId}`))
    const body = await response.json()
    expect(body.responses).toEqual([{ questionId: calculation.questionId, feature: 'calculation_grading',
      response: grading, completedAt: '2026-09-25T10:00:00Z' }])
    expect(body.responses[0].response.overallScore).toBe(0)
  })
})
