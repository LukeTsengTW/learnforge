import { describe, expect, it } from 'vitest'
import demoSource from '../content/demo.quiz.md?raw'
import { parseQuiz } from './quiz-parser'
import { gradeFillBlank, gradeMultipleChoice, gradeQuiz, gradeSingleChoice, gradeTrueFalse, hasAnswer } from './grading'
import type { FillBlankQuestion } from '../models/quiz'

const quiz = parseQuiz(demoSource)
describe('deterministic grading', () => {
  it('grades single choice, incorrect and unanswered separately', () => {
    const question = quiz.questions[0]
    if (question.type !== 'single') throw new Error('fixture type')
    expect(gradeSingleChoice(question, 'b')).toMatchObject({ status: 'correct', score: 2 })
    expect(gradeSingleChoice(question, 'a')).toMatchObject({ status: 'incorrect', score: 0 })
    expect(gradeSingleChoice(question, undefined).status).toBe('unanswered')
  })
  it('compares multiple choices as sets, independent of order', () => {
    const question = quiz.questions[2]
    if (question.type !== 'multiple') throw new Error('fixture type')
    expect(gradeMultipleChoice(question, ['d', 'c', 'b']).status).toBe('correct')
    expect(gradeMultipleChoice(question, ['b', 'c', 'd', 'b']).status).toBe('correct')
    for (const answer of [['b'], ['b', 'c'], ['a', 'b', 'c', 'd'], ['unknown']]) {
      expect(gradeMultipleChoice(question, answer)).toMatchObject({ status: 'incorrect', score: 0 })
    }
    expect(gradeMultipleChoice(question, []).status).toBe('unanswered')
  })
  it('handles both true and false without confusing false with no answer', () => {
    const question = quiz.questions[3]
    if (question.type !== 'true-false') throw new Error('fixture type')
    expect(gradeTrueFalse(question, true).status).toBe('correct')
    expect(gradeTrueFalse(question, false).status).toBe('incorrect')
    expect(gradeTrueFalse({ ...question, correctAnswer: false }, false).status).toBe('correct')
    expect(gradeTrueFalse(question, undefined).status).toBe('unanswered')
  })
  const fill = quiz.questions.find((question): question is FillBlankQuestion => question.type === 'fill')!
  it('supports exact matching without silently removing whitespace', () => {
    const question = { ...fill, match: 'exact' as const }
    expect(gradeFillBlank(question, 'XOR').status).toBe('correct')
    expect(gradeFillBlank(question, 'xor').status).toBe('incorrect')
    expect(gradeFillBlank(question, 'XOR ').status).toBe('incorrect')
    expect(gradeFillBlank(question, '   ').status).toBe('unanswered')
  })
  it('supports case-insensitive matching', () => {
    expect(gradeFillBlank(fill, 'xOr').status).toBe('correct')
    expect(gradeFillBlank(fill, 'OR').status).toBe('incorrect')
  })
  it('marks calculation and drawing manual even when unanswered', () => {
    const result = gradeQuiz(quiz, {})
    expect(result.questions[5]).toMatchObject({ status: 'manual', score: null, maxScore: null })
    expect(result.questions[6]).toMatchObject({ status: 'manual', score: null, maxScore: null })
    expect(result).toMatchObject({ score: 0, maxScore: 10, correctCount: 0, incorrectCount: 0, unansweredCount: 5, manualCount: 2 })
  })
  it('aggregates objective scores only and rejects mismatched answer types', () => {
    expect(gradeQuiz(quiz, {
      q1: { type: 'single', optionId: 'b' }, q2: { type: 'single', optionId: 'a' },
      q3: { type: 'multiple', optionIds: ['d', 'b', 'c'] }, q4: { type: 'true-false', value: true },
      q5: { type: 'fill', text: 'XOR' }, q6: { type: 'calculation', text: 'x=3' },
    })).toMatchObject({ score: 8, maxScore: 10, correctCount: 4, incorrectCount: 1, unansweredCount: 0, manualCount: 2 })
    expect(gradeQuiz(quiz, { q1: { type: 'fill', text: 'b' } }).questions[0].status).toBe('unanswered')
  })
  it('recognizes real answers including false and ignores blank text', () => {
    expect(hasAnswer({ type: 'true-false', value: false })).toBe(true)
    expect(hasAnswer({ type: 'fill', text: '\n  ' })).toBe(false)
    expect(hasAnswer({ type: 'multiple', optionIds: [] })).toBe(false)
    expect(hasAnswer({ type: 'drawing', strokes: [] })).toBe(false)
  })
})
