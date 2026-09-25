// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiGradingControls } from './AiGradingControls'
import type { AiTutorState, AiGradingState } from './use-ai-tutor'
import { quizCatalog } from '../quiz/quiz-loader'
import { gradeQuiz } from '../../lib/grading'
import type { CalculationQuestion } from '../../models/quiz'

afterEach(cleanup)
const quiz = quizCatalog.getCurrentQuiz('demo')!
const question = quiz.questions.find((item): item is CalculationQuestion => item.type === 'calculation')!
const answer = { type: 'calculation' as const, text: '因式分解得 (2x-1)(x-3)=0，故 x=1/2 或 3。' }
const graded = { kind: 'calculation_grading' as const, outcome: 'graded' as const,
  overallScore: 3, maxScore: 6,
  criteria: [
    { criterionId: 'r1', awardedScore: 2, maxScore: 2, status: 'full' as const, feedback: '因式分解正確。' },
    { criterionId: 'r2', awardedScore: 1, maxScore: 2, status: 'partial' as const, feedback: '少寫一個根。' },
    { criterionId: 'r3', awardedScore: 0, maxScore: 2, status: 'none' as const, feedback: '未代回。' },
  ], summary: '推導有部分正確。', strengths: ['正確因式分解'], improvements: ['代回兩個根'],
  confidence: 'medium' as const, requiresManualReview: true }
function tutor(remaining: number, state: AiGradingState = { kind: 'idle', response: null }): AiTutorState {
  return { enabled: true, quota: { limit: 20, used: 20 - remaining, remaining, windowSeconds: 18000,
    serverNow: '2026-09-25T12:00:00Z', nextCreditAt: null,
    featureCosts: { hint: 1, explain_mistake: 1, explain_solution: 2, calculation_grading: 2 } },
  quotaError: false, quotaLoading: false, refreshQuota: vi.fn(), restoring: false,
  restoreError: false, restore: vi.fn(), state: () => ({ kind: 'idle', response: null }),
  result: () => null, run: vi.fn(), gradingState: () => state, runGrading: vi.fn() }
}

describe('advisory calculation grading controls', () => {
  it('requires a scored rubric, nonempty answer and two credits for a new request', () => {
    const unscored = { ...question, rubric: question.rubric.map((item) => ({ ...item, score: null })) }
    const view = render(<AiGradingControls tutor={tutor(2)} question={unscored} answer={answer} />)
    expect(screen.getByText('此題未提供可量化評分規準，因此無法使用 AI 參考評分。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /取得 AI/ })).toBeNull()
    view.rerender(<AiGradingControls tutor={tutor(1)} question={question} answer={answer} />)
    expect(screen.queryByRole('button', { name: /取得 AI/ })).toBeNull()
    view.rerender(<AiGradingControls tutor={tutor(2)} question={question} answer={answer} />)
    expect(screen.getByRole('button', { name: '取得 AI 參考評分 · 2 credits' })).toBeTruthy()
    view.rerender(<AiGradingControls tutor={tutor(2)} question={question} answer={{ ...answer, text: '  ' }} />)
    expect(screen.queryByRole('heading', { name: 'AI 參考評分' })).toBeNull()
  })
  it('shows a separate suggestion, ordered rubric feedback and manual review without changing automatic grade', () => {
    const before = gradeQuiz(quiz, { [question.id]: answer })
    const ai = tutor(0, { kind: 'completed', response: graded })
    render(<AiGradingControls tutor={ai} question={question} answer={answer} />)
    expect(screen.getByText('AI 建議分數：')).toBeTruthy()
    expect(screen.getByText('3 / 6')).toBeTruthy()
    expect(screen.getByText(/部分達成/)).toBeTruthy()
    expect(screen.getByText(/建議人工覆核/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /重新評分/ })).toBeNull()
    expect(gradeQuiz(quiz, { [question.id]: answer })).toEqual(before)
    expect(before.questions.find((item) => item.questionId === question.id)).toMatchObject({ status: 'manual', score: null })
  })
  it('shows refusal without a score and uses a new request only on explicit regenerate', () => {
    const ai = tutor(2, { kind: 'completed', response: { kind: 'calculation_grading', outcome: 'refusal',
      message: 'AI 無法提供此題的參考評分。' } })
    render(<AiGradingControls tutor={ai} question={question} answer={answer} />)
    expect(screen.getByText('AI 無法提供此題的參考評分。')).toBeTruthy()
    expect(screen.queryByText(/AI 建議分數/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重新評分 · 2 credits' }))
    expect(ai.runGrading).toHaveBeenCalledWith(question.id, true)
  })
  it('keeps a retry action even when remaining credits are zero', () => {
    const ai = tutor(0, { kind: 'retryable', response: graded, message: '網路連線中斷。' })
    render(<AiGradingControls tutor={ai} question={question} answer={answer} />)
    fireEvent.click(screen.getByRole('button', { name: '重試取得前次評分' }))
    expect(ai.runGrading).toHaveBeenCalledWith(question.id)
    expect(screen.getByText('3 / 6')).toBeTruthy()
  })
})
