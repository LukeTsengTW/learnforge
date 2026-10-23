// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createHash } from 'node:crypto'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { gradeQuiz } from '../../lib/grading'
import { quizCatalog } from './quiz-loader'
import { QuestionInput } from './QuestionInput'
import { ResultQuestion } from './ResultQuestion'
import type { AnswerMap } from '../../models/attempt'

const quiz = quizCatalog.getCurrentQuiz('economics-ch1-4-exercises')!
const chapter5Keys = ['d', 'b', 'c', 'd', 'b', 'a', 'a', 'c', 'c', 'c', 'b']
const allReviewedKeys = [
  ['b', 'c', 'b', 'b', 'd', 'b', 'd', 'c'],
  ['b', 'b', 'b', 'c', 'b', 'c', 'a', 'c', 'b', 'c'],
  ['a', 'd', 'c', 'c', 'd', 'b', 'b', 'b', 'd', 'c', 'c', 'c', 'd'],
  ['d', 'a', 'd', 'a', 'd', 'a', 'a', 'd', 'c', 'd'],
  chapter5Keys,
]

afterEach(cleanup)

describe('reviewed economics chapter 5 integration', () => {
  it('adds 52 canonical revision 2 contexts while preserving all old 211 serialized contexts', () => {
    // Preserve this release's historical cohort; the later digital-systems families have their own full-baseline guards.
    const old = AI_QUIZ_CONTEXT.filter(c => c.quizId !== 'digital-systems-ch1-textbook' && c.quizId !== 'digital-systems-ch2-textbook'
      && c.quizId !== 'digital-systems-ch3-textbook'
      && !(c.quizId === quiz.id && c.revision === '2'))
    const added = AI_QUIZ_CONTEXT.filter(c => c.quizId === quiz.id && c.revision === '2')
    const beforeChapter3 = AI_QUIZ_CONTEXT.filter(c => c.quizId !== 'digital-systems-ch3-textbook')
    expect(beforeChapter3.filter(c => !(['digital-systems-ch1-textbook', 'digital-systems-ch2-textbook'].includes(c.quizId) && c.revision === '2'))).toHaveLength(331)
    expect(beforeChapter3).toHaveLength(399)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === 'digital-systems-ch3-textbook' && c.revision === '1')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === 'digital-systems-ch3-textbook' && c.revision === '2')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT).toHaveLength(447)
    expect(old).toHaveLength(211)
    expect(createHash('sha256').update(JSON.stringify(old)).digest('hex'))
      .toBe('bdaeada2f602763420ac69034aac12fb86c0c442bc1313daab65cb791fb7bfd2')
    expect(added).toHaveLength(52)
    expect(added.map(c => c.questionId)).toEqual([...quiz.questions.map(q => q.id)]
      .sort((a, b) => `${quiz.id}/2/${a}`.localeCompare(`${quiz.id}/2/${b}`)))
    for (const [index, key] of chapter5Keys.entries()) {
      expect(added.find(c => c.questionId === `ch5-q${index + 1}`))
        .toMatchObject({ type: 'single', points: 1, correctOptionId: key, questionIndex: 41 + index })
    }
  })

  it('grades all independently reviewed answers as 52/52', () => {
    const answers: AnswerMap = Object.fromEntries(allReviewedKeys.flatMap((keys, chapter) =>
      keys.map((optionId, index) => [`ch${chapter + 1}-q${index + 1}`, { type: 'single', optionId }])))
    const result = gradeQuiz(quiz, answers)
    expect(result.score).toBe(52)
    expect(result.maxScore).toBe(52)
    expect(result.questions).toHaveLength(52)
    expect(result.questions.every(q => q.status === 'correct')).toBe(true)
  })

  it('keeps every new single-choice alternative distinct and records the source reletter', () => {
    for (const question of quiz.questions.filter(q => q.id.startsWith('ch5-'))) {
      if (question.type !== 'single') throw new Error('Expected single choice')
      expect(new Set(question.options.map(o => o.content.replace(/\s/g, ''))).size, question.id)
        .toBe(question.options.length)
    }
    const question = quiz.questions.find(q => q.id === 'ch5-q3')!
    if (question.type !== 'single') throw new Error('Expected single choice')
    expect(question.options.map(o => o.id)).toEqual(['a', 'b', 'c'])
    expect(question.correctOptionId).toBe('c')
    expect(question.solution).toContain('原書答案鍵為 (d)')
    expect(gradeQuiz(quiz, { 'ch5-q3': { type: 'single', optionId: 'd' } }).score).toBe(0)
  })

  it('shows C consistently in the actual input, result and source mapping explanation', () => {
    const question = quiz.questions.find(q => q.id === 'ch5-q3')!
    render(createElement(QuestionInput, { question, answer: undefined, onChange: () => 'accepted' as const }))
    const radio = screen.getByRole('radio', { name: '你的鄰居買了一套很貴的音響' })
    expect(radio.id).toBe('answer-ch5-q3-c')
    expect(within(radio.closest('label')!).getByText('C', { exact: true })).toBeTruthy()
    cleanup()
    const answer = { type: 'single' as const, optionId: 'c' }
    const grade = gradeQuiz(quiz, { 'ch5-q3': answer }).questions[43]
    const result = render(createElement(ResultQuestion, { question, index: 43, answer, grade }))
    expect(result.container.querySelector('.reference-answer .option-letter')?.textContent).toBe('C')
    expect(result.container.querySelector('.solution-block')?.textContent).toContain('原書答案鍵為 (d)')
  })

  it.each([
    ['ch5-q3', '原書選項 (c)', '原書答案鍵為 (d)'],
    ['ch5-q5', '固定業者', '不是否定市場導向政策'],
    ['ch5-q7', '核心結論', '可成立，但不是寇斯協商結論'],
    ['ch5-q9', '尖峰同時失火', '不能僅因由政府提供'],
    ['ch5-q10', '沒有密碼', '若有效排除但仍有競爭性'],
    ['ch5-q11', '申報的願付金額', '不表示每個人都一定搭便車'],
  ])('retains the disclosed editorial distinction for %s', (id, prompt, solution) => {
    const question = quiz.questions.find(q => q.id === id)!
    expect(question.prompt).toContain(prompt)
    expect(question.solution).toContain(solution)
  })
})
