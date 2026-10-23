// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createHash } from 'node:crypto'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { gradeQuiz } from '../../lib/grading'
import { quizCatalog } from './quiz-loader'
import type { AnswerMap } from '../../models/attempt'
import { QuestionInput } from './QuestionInput'
import { ResultQuestion } from './ResultQuestion'

const quiz = quizCatalog.getQuizRevision('economics-ch1-4-exercises', '1')!
const reviewedKeys = [
  ['b', 'c', 'b', 'b', 'd', 'b', 'd', 'c'],
  ['b', 'b', 'b', 'c', 'b', 'c', 'a', 'c', 'b', 'c'],
  ['a', 'd', 'c', 'c', 'd', 'b', 'b', 'b', 'd', 'c', 'c', 'c', 'd'],
  ['d', 'a', 'd', 'a', 'd', 'a', 'a', 'd', 'c', 'd'],
]

afterEach(cleanup)

describe('reviewed economics quiz publication', () => {
  it('retains all 41 historical canonical contexts and all 170 other shipped contexts', () => {
    const existing = AI_QUIZ_CONTEXT.filter((context) => context.quizId !== quiz.id
      && context.quizId !== 'digital-systems-ch1-textbook' && context.quizId !== 'digital-systems-ch2-textbook'
      && context.quizId !== 'digital-systems-ch3-textbook')
    const added = AI_QUIZ_CONTEXT.filter((context) => context.quizId === quiz.id && context.revision === '1')
    const beforeChapter3 = AI_QUIZ_CONTEXT.filter(c => c.quizId !== 'digital-systems-ch3-textbook')
    expect(beforeChapter3.filter(c => !(['digital-systems-ch1-textbook', 'digital-systems-ch2-textbook'].includes(c.quizId) && c.revision === '2'))).toHaveLength(331)
    expect(beforeChapter3).toHaveLength(399)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === 'digital-systems-ch3-textbook' && c.revision === '1')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === 'digital-systems-ch3-textbook' && c.revision === '2')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT).toHaveLength(447)
    expect(existing).toHaveLength(170)
    expect(createHash('sha256').update(JSON.stringify(existing)).digest('hex'))
      .toBe('ef83b87e46c1b453466529a96a0c8ecc292c74899d8abffdee2caa00d69cd317')
    expect(added).toHaveLength(41)
    expect(added.every(({ revision, points, type }) => revision === '1' && points === 1 && type === 'single')).toBe(true)
    expect(new Set(added.map(({ questionId }) => questionId))).toEqual(new Set(quiz.questions.map(({ id }) => id)))
  })

  it('retains the historical chapter order alongside one current 52-point revision', () => {
    const entries = quizCatalog.current.filter(({ quiz }) => quiz.id === 'economics-ch1-4-exercises')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ questionCount: 52, totalPoints: 52, maxPoints: 52,
      quiz: { revision: '2', current: true, subject: '經濟學', estimatedMinutes: 120 } })
    expect(quiz).toMatchObject({ revision: '1', current: false, estimatedMinutes: 90 })
    expect(quiz.questions).toHaveLength(41)
    expect(quiz.questions.map(({ id }) => id)).toEqual(reviewedKeys.flatMap((keys, chapter) =>
      keys.map((_, index) => `ch${chapter + 1}-q${index + 1}`)))
    expect(quiz.questions.every(({ type, points }) => type === 'single' && points === 1)).toBe(true)
  })

  it('offers distinct alternatives with sequential visible letters after duplicate removal', () => {
    for (const question of quiz.questions) {
      if (question.type !== 'single') throw new Error('Expected an objective single-choice question')
      const choices = question.options.map(({ content }) => content.replace(/\s/g, ''))
      expect(new Set(choices).size, question.id).toBe(choices.length)
    }
    const question = quiz.questions.find(({ id }) => id === 'ch2-q1')!
    if (question.type !== 'single') throw new Error('Expected a single-choice question')
    expect(question.options.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
    expect(question.correctOptionId).toBe('b')
  })

  it('grades the independently reviewed answers as 41/41', () => {
    const answers: AnswerMap = Object.fromEntries(reviewedKeys.flatMap((keys, chapter) =>
      keys.map((optionId, index) => [`ch${chapter + 1}-q${index + 1}`, { type: 'single', optionId }])))
    const result = gradeQuiz(quiz, answers)
    expect(result.score).toBe(41)
    expect(result.maxScore).toBe(41)
    expect(result.unansweredCount).toBe(0)
  })

  it('uses visible B consistently in the milk question, result and explanation', () => {
    const question = quiz.questions.find(({ id }) => id === 'ch2-q1')!
    render(createElement(QuestionInput, { question, answer: undefined, onChange: () => 'accepted' as const }))
    const radio = screen.getByRole('radio', { name: '天氣炎熱，乳牛的泌乳量減少' })
    expect(radio.id).toBe('answer-ch2-q1-b')
    expect(within(radio.closest('label')!).getByText('B', { exact: true })).toBeTruthy()
    cleanup()
    const answer = { type: 'single' as const, optionId: 'b' }
    const grade = gradeQuiz(quiz, { 'ch2-q1': answer }).questions[8]
    const result = render(createElement(ResultQuestion, { question, index: 8, answer, grade }))
    expect(result.container.querySelector('.reference-answer .option-letter')?.textContent).toBe('B')
    expect(result.container.querySelector('.solution-block')?.textContent).toContain('本版正確答案為 (b)')
  })

  it('rejects the two incorrect printed answer keys', () => {
    const result = gradeQuiz(quiz, {
      'ch3-q1': { type: 'single', optionId: 'd' },
      'ch4-q5': { type: 'single', optionId: 'b' },
    })
    expect(result.score).toBe(0)
  })
})
