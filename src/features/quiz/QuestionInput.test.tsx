// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QUESTION_TYPE } from '../../models/quiz'
import { quizCatalog } from './quiz-loader'
import { QuestionCard } from './QuestionCard'
import { QuestionInput } from './QuestionInput'

const quiz = quizCatalog.getCurrentQuiz('demo')!
const notice = '提交後會依評分規準由 AI 自動評分並納入本次練習得分。AI 自動評分僅供學習參考，可能存在誤判。'
afterEach(cleanup)

describe('current rubric-scored answer inputs', () => {
  it('labels calculation and drawing points as AI scored on current practice cards', () => {
    const questions = quiz.questions.filter((item) => item.type === QUESTION_TYPE.calculation || item.type === QUESTION_TYPE.drawing)
    for (const question of questions) {
      render(<QuestionCard question={question} index={0} answer={undefined} onChange={() => undefined} />)
      expect(screen.getByText(`${question.points} 分・AI 自動評分`)).toBeInTheDocument()
      expect(screen.queryByText(/自行對照/)).toBeNull()
      cleanup()
    }
  })

  it('explains that calculation grading contributes to the practice score', () => {
    const question = quiz.questions.find((item) => item.type === QUESTION_TYPE.calculation)!
    render(<QuestionInput question={question} answer={undefined} onChange={() => undefined} />)
    expect(screen.getByText(notice)).toBeInTheDocument()
    expect(screen.queryByText(/不納入自動分數|自行對照/)).toBeNull()
  })

  it('explains that drawing grading contributes to the practice score', () => {
    const question = quiz.questions.find((item) => item.type === QUESTION_TYPE.drawing)!
    render(<QuestionInput question={question} answer={undefined} onChange={() => undefined} />)
    expect(screen.getByText(notice)).toBeInTheDocument()
    expect(screen.queryByText(/不納入自動分數|自行對照/)).toBeNull()
  })
})
