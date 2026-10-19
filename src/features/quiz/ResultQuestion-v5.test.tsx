// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { PracticeAnswerV5 } from '../../models/draft-v4'
import { GRADE_STATUS } from '../../models/attempt'
import { ResultQuestion } from './ResultQuestion'
import { pen, v4Quiz } from './practice-v4.test-helper'

vi.mock('../ai/AiGradingControls', () => ({ AiGradingControls: () => null }))
vi.mock('../ai/AiDrawingControls', () => ({ AiDrawingControls: () => null }))
vi.mock('../ai/AiTutorControls', () => ({ AiTutorControls: () => null }))

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() } as unknown as CanvasRenderingContext2D)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const question = v4Quiz.questions.find((item) => item.id === 'q_hand')!
const grade = { questionId: question.id, type: 'calculation' as const, status: GRADE_STATUS.manual, score: null, maxScore: null }

describe('M6 schema-3 handwritten result', () => {
  it('renders every submitted page separately with an accessible page label', () => {
    const answer: PracticeAnswerV5 = { type: 'calculation', mode: 'drawing', text: 'INACTIVE_TEXT', pages: [[pen()], [], [pen()]] }
    render(<ResultQuestion question={question} answer={answer} grade={grade} index={0} />)

    expect(screen.getByRole('img', { name: '第 1 頁手寫作答' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '第 2 頁手寫作答' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '第 3 頁手寫作答' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /匯出第 .* 頁手寫 PNG/ })).toHaveLength(3)
    expect(document.body.textContent).not.toContain('INACTIVE_TEXT')
  })

  it('does not render inactive pages while text mode is active', () => {
    const answer: PracticeAnswerV5 = { type: 'calculation', mode: 'text', text: 'ACTIVE_TEXT', pages: [[pen()], [pen()]] }
    render(<ResultQuestion question={question} answer={answer} grade={grade} index={0} />)

    expect(screen.getByText('ACTIVE_TEXT')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /手寫作答/ })).toBeNull()
  })
})
