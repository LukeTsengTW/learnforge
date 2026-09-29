// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { AiTutorState } from '../ai/use-ai-tutor'
import type { QuestionGrade } from '../../models/attempt'
import type { CalculationQuestion, DrawingQuestion } from '../../models/quiz'
import { GRADING_VERSION } from '../../models/grading-version'
import { ResultQuestion } from './ResultQuestion'

vi.mock('../ai/AiGradingControls', () => ({ AiGradingControls: () => <div data-testid="ai-grading-controls" /> }))
vi.mock('../ai/AiDrawingControls', () => ({ AiDrawingControls: () => <div data-testid="ai-drawing-controls" /> }))
vi.mock('../ai/AiTutorControls', () => ({ AiTutorControls: () => <div data-testid="ai-tutor-controls" /> }))

afterEach(cleanup)

const calculation: CalculationQuestion = { id: 'calc', type: 'calculation', tags: [], points: 2,
  prompt: 'Solve x.', hint: null, solution: 'Show the steps.', referenceAnswer: 'x=2',
  rubric: [{ description: 'Set up equation', score: 1 }, { description: 'Solve equation', score: 1 }] }
const drawing: DrawingQuestion = { id: 'draw', type: 'drawing', tags: [], points: 2,
  prompt: 'Draw a shape.', hint: null, solution: 'Use connected lines.', referenceAnswer: 'A triangle',
  drawing: { width: 100, height: 100 }, rubric: [{ description: 'Closed outline', score: 1 }, { description: 'Label', score: 1 }] }
const aiTutor = {} as AiTutorState
const rubricGrade = (questionId: string, type: 'calculation' | 'drawing'): QuestionGrade => ({
  questionId, type, status: 'partial', score: 1, maxScore: 2, source: 'ai', answerHash: 'a'.repeat(64),
  criteria: [{ criterionId: 'r1', awardedScore: 1, maxScore: 1, status: 'full', feedback: 'Clear.' },
    { criterionId: 'r2', awardedScore: 0, maxScore: 1, status: 'none', feedback: 'Add evidence.' }],
  confidence: 'medium', summary: 'Some criteria are met.',
  ...(type === 'calculation' ? { strengths: ['Correct setup'], improvements: ['Show the final step'] }
    : { observations: ['The outline is visible'], missingOrUnclear: ['The label is missing'] }),
})

describe('v3 result question presentation', () => {
  it.each([
    ['calculation', calculation], ['drawing', drawing],
  ] as const)('shows rubric evidence and hides advisory grading controls for v3 %s', (type, question) => {
    const answer = type === 'calculation' ? { type, text: 'x=2' } : { type, strokes: [] }
    render(<ResultQuestion question={question} answer={answer} grade={rubricGrade(question.id, type)} index={0}
      gradingVersion={GRADING_VERSION.aiGradingV3} aiTutor={aiTutor} />)
    expect(screen.getByText('△ 部分得分')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'AI 自動評分' })).toHaveTextContent('1 / 2 分')
    expect(screen.getByText('AI 自動評分僅供學習參考，可能存在誤判。')).toBeInTheDocument()
    expect(document.querySelector('.manual-notice')).toBeNull()
    expect(screen.queryByTestId('ai-grading-controls')).toBeNull()
    expect(screen.queryByTestId('ai-drawing-controls')).toBeNull()
  })

  it('keeps the historical semantic-fill-v2 manual message and advisory controls', () => {
    const grade: QuestionGrade = { questionId: calculation.id, type: 'calculation', status: 'manual', score: null, maxScore: null }
    render(<ResultQuestion question={calculation} answer={{ type: 'calculation', text: 'x=2' }} grade={grade}
      index={0} gradingVersion={GRADING_VERSION.semanticFillV2} aiTutor={aiTutor} />)
    expect(screen.getByText(/計算題不納入自動評分/)).toBeInTheDocument()
    expect(screen.getByTestId('ai-grading-controls')).toBeInTheDocument()
    expect(screen.queryByText('AI 自動評分僅供學習參考，可能存在誤判。')).toBeNull()
  })
})
