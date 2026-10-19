import { describe, expect, it, vi } from 'vitest'
import { answerQuizDraftV5, draftAnswerMapBytesV5, draftAnswerProblemV5, emptyCalculationAnswerV5 } from './draft-v5'
import { DRAFT_V5_LIMITS } from '../../supabase/functions/_shared/draft-v5'
import type { DraftAnswerMapV5, QuizDraftV5 } from '../models/draft-v5'
import { quizCatalog } from '../features/quiz/quiz-loader'

vi.mock('../features/quiz/quiz-loader', async (importOriginal) => (await import('../test-fixtures/fixture-quizzes.test-helper')).withFixtureQuizzes(await importOriginal<typeof import('../features/quiz/quiz-loader')>()))

const baseQuiz = quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')!
const fillQuestion = baseQuiz.questions.find((question) => question.type === 'fill')!
const capacityQuiz = { ...baseQuiz, revision: 'capacity-v5', questions: Array.from({ length: 43 }, (_, index) => ({
  ...fillQuestion, id: `fill_${index}`,
})) }
const now = '2026-10-19T00:00:00.000Z'
const fillAnswer = (text: string) => ({ type: 'fill' as const, text })

describe('schema-3 draft persistence helpers', () => {
  it('uses canonical empty pages only for drawing-capable calculations', () => {
    expect(emptyCalculationAnswerV5(true)).toEqual({ type: 'calculation', mode: 'text', text: '', pages: [[]] })
    expect(emptyCalculationAnswerV5(false)).toEqual({ type: 'calculation', mode: 'text', text: '', pages: [] })
  })

  it('measures UTF-8 aggregate answer bytes and permits capacity-releasing updates', () => {
    const answers = Object.fromEntries(Array.from({ length: 42 }, (_, index) => [`fill_${index}`, fillAnswer('x'.repeat(100_000))])) as DraftAnswerMapV5
    const draft: QuizDraftV5 = { schemaVersion: 3, quizId: capacityQuiz.id, quizRevision: capacityQuiz.revision,
      status: 'in-progress', startedAt: now, updatedAt: now, answers }
    expect(draftAnswerMapBytesV5(answers)).toBeGreaterThan(DRAFT_V5_LIMITS.maxAnswerBytes)
    expect(draftAnswerProblemV5(capacityQuiz, draft, 'fill_42', fillAnswer('x'.repeat(100_000)))).toBe('draft-oversized')
    expect(answerQuizDraftV5(capacityQuiz, draft, 'fill_42', fillAnswer('x'.repeat(100_000)), now)).toBe(draft)

    const cleared = answerQuizDraftV5(capacityQuiz, draft, 'fill_0', fillAnswer(''), now)
    expect(cleared).not.toBe(draft)
    expect(cleared.answers.fill_0).toEqual(fillAnswer(''))
    expect(draftAnswerMapBytesV5(cleared.answers)).toBeLessThan(draftAnswerMapBytesV5(answers))
  })
})
