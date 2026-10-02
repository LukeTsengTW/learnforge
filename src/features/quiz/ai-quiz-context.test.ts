import { describe, expect, it } from 'vitest'
import demoSource from '../../content/quizzes/demo/v1.quiz.md?raw'
import { toTutorContext } from '../../../scripts/ai-quiz-context'
import { parseQuiz } from '../../lib/quiz-parser'

const quiz = parseQuiz(demoSource)
const calculation = quiz.questions.find((question) => question.type === 'calculation')!

describe('exact revision quiz context foundation', () => {
  it('leaves current calculation context text-only and preserves canonical rubric fields', () => {
    const context = toTutorContext(quiz, calculation)
    expect(context).not.toHaveProperty('drawing')
    expect(context).toMatchObject({
      quizId: 'demo', revision: 'v1-7d7c900e', questionId: 'q6', type: 'calculation',
      referenceAnswer: calculation.referenceAnswer, points: 6,
      gradingRubric: [
        { id: 'r1', points: 2, description: calculation.rubric[0].description },
        { id: 'r2', points: 2, description: calculation.rubric[1].description },
        { id: 'r3', points: 2, description: calculation.rubric[2].description },
      ],
    })
  })

  it('preserves only explicitly declared calculation config in a synthetic new revision', () => {
    const question = { ...calculation, drawing: { width: 1000, height: 700 } }
    const next = { ...quiz, revision: 'synthetic-m1', questions: quiz.questions.map((item) => item.id === question.id ? question : item) }
    expect(toTutorContext(next, question)).toEqual({
      ...toTutorContext(quiz, calculation), revision: 'synthetic-m1', drawing: { width: 1000, height: 700 },
    })
    expect(calculation).not.toHaveProperty('drawing')
  })

  it('preserves existing drawing-question context', () => {
    const question = quiz.questions.find((item) => item.type === 'drawing')!
    expect(toTutorContext(quiz, question)).toMatchObject({
      type: 'drawing', drawing: { width: 800, height: 600 },
    })
  })
})
