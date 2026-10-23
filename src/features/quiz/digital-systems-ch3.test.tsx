// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { Markdown } from '../../components/Markdown'
import { validateV4Publication } from '../../lib/scored-rubric'
import { quizMarkdownFields, validateQuizFigures } from '../../lib/quiz-figures'
import { figuresForQuiz } from './quiz-figures'
import { bundledQuizSources, quizCatalog } from './quiz-loader'

const id = 'digital-systems-ch3-textbook'
const quiz = quizCatalog.getQuizRevision(id, '1')!
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const labels = [
  'Example 3-1','Example 3-2','Example 3-3','Example 3-4',
  'Practice Exercise 3.1','Practice Exercise 3.2','Practice Exercise 3.3','Practice Exercise 3.4',
  'Example 3-5','Example 3-6','Practice Exercise 3.5','Practice Exercise 3.6','Practice Exercise 3.7',
  'Example 3-7','Practice Exercise 3.8','Example 3-8','Practice Exercise 3.9','Example:',
  'Example 3-9','Practice Exercise 3.10','Example:','Example:','Practice Exercise 3.11','Example 3-10',
]

afterEach(cleanup)

describe('source-audited digital systems chapter 3 integration', () => {
  it('publishes the source inventory in order with v4 scored handwriting metadata', () => {
    expect(quizCatalog.errors).toEqual([])
    expect(quiz).toMatchObject({ id, revision: '1', current: true,
      title: '【課本題目】數位系統導論 - Chapter 3', subject: '數位系統導論', estimatedMinutes: 135 })
    expect(quizCatalog.current).toHaveLength(14)
    expect(Object.keys(bundledQuizSources)).toHaveLength(19)
    expect(quizCatalog.current.filter(entry => entry.quiz.id === id)).toHaveLength(1)
    expect(quizCatalog.current.find(entry => entry.quiz.id === id))
      .toMatchObject({ questionCount: 24, totalPoints: 152, maxPoints: 0 })
    expect(quiz.questions.map(q => q.id)).toEqual(Array.from({ length: 24 }, (_, i) => `q${String(i + 1).padStart(2, '0')}`))
    expect(quiz.questions.map(q => q.prompt.split('\n')[0])).toEqual(labels.map(label => `### ${label}`))
    expect(validateV4Publication(quiz)).toEqual([])
    for (const q of quiz.questions) {
      expect(q.type).toBe('calculation')
      if (q.type !== 'calculation') throw new Error('Expected calculation')
      expect(q.drawing).toEqual({ width: 1200, height: 900 })
      expect(q.referenceAnswer.trim().length).toBeGreaterThan(0)
      expect(q.solution.trim().length).toBeGreaterThan(0)
      expect(q.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)).toBe(q.points)
      expect(q.prompt).not.toMatch(/[\u3400-\u9fff]/)
    }
  })

  it('preserves all eighteen prior source revisions and every one of 399 canonical contexts', () => {
    const sources = Object.entries(bundledQuizSources).filter(([file]) => !file.includes(`/${id}/`))
      .map(([file, source]) => [file.split('/quizzes/')[1], source.replaceAll('\r\n', '\n')])
      .sort(([a], [b]) => a.localeCompare(b))
    expect(sources).toHaveLength(18)
    expect(sha(sources)).toBe('e53a0ddc129d3bf1d7191794e5c84d5d0023da1f1c642025c59441087acfd2f7')
    const prior = AI_QUIZ_CONTEXT.filter(c => c.quizId !== id)
    expect(prior).toHaveLength(399)
    expect(sha(prior)).toBe('0139dcc36ac51cca4d15296a22b55fff06975636be4eef7a1a6a3a8c990470ea')
    expect(AI_QUIZ_CONTEXT).toHaveLength(423)
  })

  it('binds all 24 new contexts to the exact published content and source index', () => {
    const contexts = AI_QUIZ_CONTEXT.filter(c => c.quizId === id && c.revision === '1')
    expect(contexts).toHaveLength(24)
    for (const [index, q] of quiz.questions.entries()) {
      if (q.type !== 'calculation') throw new Error('Expected calculation')
      expect(contexts.find(c => c.questionId === q.id)).toMatchObject({ questionIndex: index,
        prompt: q.prompt, referenceAnswer: q.referenceAnswer, solution: q.solution,
        rubric: q.rubric, points: q.points, drawing: q.drawing })
    }
  })

  it('recomputes saved answers, all prime implicants, minimum covers, dont-cares and gate equations', () => {
    const result = JSON.parse(execFileSync(process.execPath, ['scripts/audit-digital-systems-ch3.mjs'], { encoding: 'utf8' }))
    expect(result).toMatchObject({ status: 'PASS', questions: 24, checks: 510,
      primeImplicants: ["w'x", "w'z'", "x'z'", 'xy', 'xz', "yz'"] })
    expect(quiz.questions[12].solution).toContain('投影片答案誤植')
    expect(quiz.questions[14].solution).toContain('0000')
    expect(quiz.questions[22].solution).toContain("(w'x+wx')'")
  })

  it('resolves only the three safe same-quiz SVGs through the real asset loader', () => {
    const figures = figuresForQuiz(id)
    expect(Object.keys(figures).sort()).toEqual(['figures/figure-3-25.svg','figures/pe3-10.svg','figures/pe3-11.svg'])
    expect(() => validateQuizFigures(quiz, Object.keys(figures))).not.toThrow()
    expect(() => validateQuizFigures('![](../other/figure.svg)', Object.keys(figures))).toThrow('Invalid quiz figure')
    expect(() => validateQuizFigures('![](figures/missing.svg)', Object.keys(figures))).toThrow('Missing quiz figure')
    for (const url of Object.values(figures)) expect(url).toMatch(/digital-systems-ch3-textbook\/figures\/.*\.svg/)
  })

  it('renders every saved Markdown field with KaTeX and resolved images without raw delimiters', () => {
    const figures = figuresForQuiz(id)
    const view = render(<>{quizMarkdownFields(quiz).map((field, index) =>
      <Markdown key={index} figures={figures}>{field}</Markdown>)}</>)
    expect(view.container.querySelectorAll('.katex').length).toBeGreaterThan(200)
    expect(view.container.querySelectorAll('.katex-error')).toHaveLength(0)
    expect(view.container.textContent).not.toContain(':::')
    expect(view.container.textContent).not.toContain('$')
    expect(view.container.querySelectorAll('img')).toHaveLength(3)
    for (const img of view.container.querySelectorAll('img')) expect(img.getAttribute('src')).toBeTruthy()
    expect(view.container.querySelectorAll('.quiz-figure-unavailable')).toHaveLength(0)
  })
})
