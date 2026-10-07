import { describe, expect, it } from 'vitest'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { tutorContext } from '../../../supabase/functions/_shared/ai-tutor'
import { createSubmissionHandwrittenCalculationRequest } from '../../../supabase/functions/_shared/calculation-grading'
import { requiresV4DraftContext } from '../../../supabase/functions/_shared/draft-v4'
import { decodeDraftAnswersV4, decodeQuizDraftV4, requiresV4Draft } from '../../lib/draft-v4'
import { hasAnswer } from '../../lib/grading'
import { projectActiveCalculationAnswer } from '../../lib/calculation-answer'
import { createAttempt } from '../../lib/attempt'
import { decodeAttempt } from '../../lib/attempt-storage'
import type { CalculationAnswerV4 } from '../../models/attempt'
import type { CalculationQuestion } from '../../models/quiz'
import { quizCatalog } from './quiz-loader'
import { calcHand, calcText, fixture, pen, submit, v1 } from './submission-v4.test-helper'

const ids = ['q2', 'q3', 'q4', 'q5', 'q6']
const historical = () => quizCatalog.getQuizRevision('discrete-math', '1')!
const current = () => quizCatalog.getQuizRevision('discrete-math', '2')!

describe('discrete math exact-revision multimodal pipeline', () => {
  it('selects v4 only from the exact revision and preserves historical attempt decoding', () => {
    expect(requiresV4Draft(historical())).toBe(false)
    expect(requiresV4Draft(current())).toBe(true)
    expect(requiresV4DraftContext(tutorContext.listRevision('discrete-math', '1'))).toBe(false)
    expect(requiresV4DraftContext(tutorContext.listRevision('discrete-math', '2'))).toBe(true)
    const attempt = createAttempt(historical(), v1)
    expect(decodeAttempt(JSON.stringify(attempt), historical())).toEqual(attempt)
    expect(decodeAttempt(JSON.stringify(attempt), current())).toBeNull()
  })

  it('adds only revision identity and declared capability to canonical question contexts', () => {
    const old = tutorContext.listRevision('discrete-math', '1')
    const next = tutorContext.listRevision('discrete-math', '2')
    expect(old).toHaveLength(11)
    expect(next).toHaveLength(11)
    expect(AI_QUIZ_CONTEXT.filter((context) => context.quizId === 'discrete-math'))
      .toHaveLength(old.length + next.length)
    for (const before of old) {
      const after = tutorContext.get('discrete-math', '2', before.questionId)
      expect(before).not.toHaveProperty('drawing')
      expect(after).toEqual({ ...before, revision: '2',
        ...(before.type === 'calculation' ? { drawing: { width: 1200, height: 900 } } : {}) })
    }
  })

  it.each(ids)('persists both %s buffers in schema 2 and detects answers from the active mode only', (id) => {
    const question = current().questions.find((item) => item.id === id) as CalculationQuestion
    const answer: CalculationAnswerV4 = { type: 'calculation', mode: 'drawing', text: '$x=3$', strokes: [pen()] }
    const draft = { schemaVersion: 2, quizId: 'discrete-math', quizRevision: '2', status: 'in-progress',
      startedAt: v1, updatedAt: v1, answers: { [id]: answer } }
    expect(decodeQuizDraftV4(JSON.stringify(draft), current())).toEqual(draft)
    expect(decodeDraftAnswersV4(historical(), draft.answers)).toBeNull()
    expect(hasAnswer({ ...answer, strokes: [] })).toBe(false)
    expect(hasAnswer({ ...answer, mode: 'text', text: '　\n' })).toBe(false)
    expect(hasAnswer(answer)).toBe(true)
    expect(hasAnswer({ ...answer, mode: 'text' })).toBe(true)
    expect(projectActiveCalculationAnswer(answer, question)).toEqual({ type: 'calculation', mode: 'drawing', strokes: [pen()] })
    expect(projectActiveCalculationAnswer({ ...answer, mode: 'text' }, question))
      .toEqual({ type: 'calculation', mode: 'text', text: '$x=3$' })
  })

  it('submits all five handwritten answers through v4 and constructs server PNG requests without inactive text', async () => {
    const test = fixture(Object.fromEntries(ids.map((id) => [id, calcHand([pen()], 'INACTIVE_TEXT_SENTINEL')])),
      { quizId: 'discrete-math', revision: '2', lookup: tutorContext })
    const response = await test.submit(submit())
    expect(response.status).toBe(200)
    expect(test.state.attempt.grading_version).toBe('ai-grading-v4')
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(5)
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
    expect(test.v3CalculationProvider.generate).not.toHaveBeenCalled()
    expect(test.state.claims.every((claim) => claim.version === 'v4')).toBe(true)
    for (const [context, png] of test.calculationV4.generateDrawing.mock.calls) {
      expect(ids).toContain(context.questionId)
      expect(context).toMatchObject({ quizId: 'discrete-math', revision: '2', drawing: { width: 1200, height: 900 } })
      expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
      const request = createSubmissionHandwrittenCalculationRequest(context, png)
      expect(JSON.stringify(request)).toContain('data:image/png;base64,')
      expect(JSON.stringify(request)).not.toContain('INACTIVE_TEXT_SENTINEL')
    }
  })

  it('grades only selected text in revision 2 and keeps revision 1 on v3', async () => {
    const next = fixture(Object.fromEntries(ids.map((id) => [id, calcText('typed solution', [pen()])])),
      { quizId: 'discrete-math', revision: '2', lookup: tutorContext })
    expect((await next.submit(submit())).status).toBe(200)
    expect(next.state.attempt.grading_version).toBe('ai-grading-v4')
    expect(next.calculationV4.generateText).toHaveBeenCalledTimes(5)
    expect(next.calculationV4.generateDrawing).not.toHaveBeenCalled()
    for (const [, text] of next.calculationV4.generateText.mock.calls) expect(text).toBe('typed solution')
    const old = fixture(Object.fromEntries(ids.map((id) => [id, { type: 'calculation', text: 'historical solution' }])),
      { quizId: 'discrete-math', revision: '1', schema: 1, lookup: tutorContext })
    expect((await old.submit(submit())).status).toBe(200)
    expect(old.state.attempt.grading_version).toBe('ai-grading-v3')
    expect(old.v3CalculationProvider.generate).toHaveBeenCalledTimes(5)
    expect(old.calculationV4.generateText).not.toHaveBeenCalled()
    expect(old.calculationV4.generateDrawing).not.toHaveBeenCalled()
  })
})
