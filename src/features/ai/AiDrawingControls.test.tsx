// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiDrawingControls } from './AiDrawingControls'
import type { AiDrawingState, AiTutorState } from './use-ai-tutor'
import { quizCatalog } from '../quiz/quiz-loader'
import { gradeQuiz } from '../../lib/grading'
import type { DrawingQuestion } from '../../models/quiz'

afterEach(cleanup)
const quiz = quizCatalog.getCurrentQuiz('demo')!
const question = quiz.questions.find((item): item is DrawingQuestion => item.type === 'drawing')!
const pen = { tool: 'pen' as const, color: '#202b38' as const, width: 4,
  points: [{ x: 20, y: 30 }, { x: 100, y: 30 }] }
const answer = { type: 'drawing' as const, strokes: [pen] }
const analyzed = { kind: 'drawing_analysis' as const, outcome: 'analyzed' as const,
  overallScore: 2.5, maxScore: 4,
  criteria: [
    { criterionId: 'r1', awardedScore: 1, maxScore: 1, status: 'full' as const, feedback: '外框可見。' },
    { criterionId: 'r2', awardedScore: 0.5, maxScore: 1, status: 'partial' as const, feedback: '輸入不明。' },
    { criterionId: 'r3', awardedScore: 1, maxScore: 1, status: 'full' as const, feedback: '輸出可見。' },
    { criterionId: 'r4', awardedScore: 0, maxScore: 1, status: 'none' as const, feedback: '未見公式。' },
  ], observations: ['輸出線'], missingOrUnclear: ['公式不清楚'], summary: '有部分結構。',
  confidence: 'low' as const, requiresManualReview: true }
function tutor(remaining: number, state: AiDrawingState = { kind: 'idle', response: null }): AiTutorState {
  return { enabled: true, quota: { limit: 20, used: 20 - remaining, remaining, windowSeconds: 18000,
    serverNow: '2026-09-25T12:00:00Z', nextCreditAt: null,
    featureCosts: { hint: 1, explain_mistake: 1, explain_solution: 2, calculation_grading: 2, drawing_analysis: 4 } },
  quotaError: false, quotaLoading: false, refreshQuota: vi.fn(), restoring: false,
  restoreError: false, restore: vi.fn(), state: () => ({ kind: 'idle', response: null }),
  result: () => null, run: vi.fn(), gradingState: () => ({ kind: 'idle', response: null }), runGrading: vi.fn(),
  drawingState: () => state, runDrawing: vi.fn() }
}

describe('advisory drawing controls', () => {
  it('requires visible ink, a scored rubric and four credits for a new request', () => {
    const erased = { type: 'drawing' as const, strokes: [pen, { ...pen, tool: 'eraser' as const, width: 12 }] }
    const view = render(<AiDrawingControls tutor={tutor(4)} question={question} answer={erased} />)
    expect(screen.queryByRole('button', { name: /取得 AI/ })).toBeNull()
    view.rerender(<AiDrawingControls tutor={tutor(4)} question={{ ...question,
      rubric: question.rubric.map((item) => ({ ...item, score: null })) }} answer={answer} />)
    expect(screen.queryByRole('button', { name: /取得 AI/ })).toBeNull()
    view.rerender(<AiDrawingControls tutor={tutor(3)} question={question} answer={answer} />)
    expect(screen.queryByRole('button', { name: /取得 AI/ })).toBeNull()
    view.rerender(<AiDrawingControls tutor={tutor(4)} question={question} answer={answer} />)
    expect(screen.getByRole('button', { name: '取得 AI 圖像參考分析 · 4 credits' })).toBeTruthy()
  })
  it('shows separate rubric feedback and keeps the deterministic grade unchanged', () => {
    const before = gradeQuiz(quiz, { [question.id]: answer })
    render(<AiDrawingControls tutor={tutor(0, { kind: 'completed', response: analyzed })}
      question={question} answer={answer} />)
    expect(screen.getByRole('heading', { name: 'AI 圖像參考分析' })).toBeTruthy()
    expect(screen.getAllByText(/AI 圖像分析僅供學習參考/)).toHaveLength(1)
    expect(screen.getByText('2.5 / 4')).toBeTruthy()
    expect(screen.getByText(/部分符合/)).toBeTruthy()
    expect(screen.getByText('輸出線')).toBeTruthy()
    expect(screen.getByText('公式不清楚')).toBeTruthy()
    expect(screen.getByText(/建議人工覆核/)).toBeTruthy()
    expect(gradeQuiz(quiz, { [question.id]: answer })).toEqual(before)
    expect(before.questions.find((item) => item.questionId === question.id)).toMatchObject({ status: 'manual', score: null })
  })
  it('shows a refusal without a zero score and regenerates only after a click', () => {
    const ai = tutor(4, { kind: 'completed', response: { kind: 'drawing_analysis', outcome: 'refusal',
      message: 'AI 無法可靠分析此圖。' } })
    render(<AiDrawingControls tutor={ai} question={question} answer={answer} />)
    expect(screen.getByText('AI 無法可靠分析此圖。')).toBeTruthy()
    expect(screen.queryByText(/AI 建議分數/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重新分析 · 4 credits' }))
    expect(ai.runDrawing).toHaveBeenCalledWith(question.id, true)
  })
})
