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
const historical = quizCatalog.getQuizRevision(id, '1')!
const quiz = quizCatalog.getQuizRevision(id, '2')!
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const tasks: Record<string, string> = {
  q01: 'Using a K-map, simplify the Boolean function.',
  q02: 'Using a K-map, simplify the Boolean function.',
  q03: 'Using a K-map, simplify the Boolean function.',
  q09: 'Using a K-map, simplify the Boolean function.',
  q14: 'Using a K-map, obtain the simplified sum-of-products and product-of-sums forms of the Boolean function.',
  q16: "Using a K-map and the don't-care conditions, simplify the Boolean function.",
  q18: 'Implement the Boolean function using two-level NAND-NAND logic.',
  q19: 'Using a K-map, simplify the Boolean function and implement it using two-level NAND-NAND logic.',
  q21: 'Implement the Boolean function using NOR gates.',
  q22: 'Implement the Boolean function using NOR gates.',
  q24: "Using the given form of $F'$, derive equivalent AOI and OAI implementations of $F$.",
}
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
    expect(historical).toMatchObject({ id, revision: '1', current: false })
    expect(quiz).toMatchObject({ id, revision: '2', current: true,
      title: '【課本題目】數位系統導論 - Chapter 3', subject: '數位系統導論', estimatedMinutes: 135 })
    expect(quizCatalog.current).toHaveLength(16)
    expect(Object.keys(bundledQuizSources)).toHaveLength(22)
    expect(quizCatalog.current.reduce((total, entry) => total + entry.questionCount, 0)).toBe(340)
    expect(quizCatalog.current.filter(entry => entry.quiz.id === id)).toHaveLength(1)
    expect(quizCatalog.current.find(entry => entry.quiz.id === id))
      .toMatchObject({ quiz: { revision: '2' }, questionCount: 24, totalPoints: 152, maxPoints: 0 })
    expect(quiz.questions.map(q => q.id)).toEqual(Array.from({ length: 24 }, (_, i) => `q${String(i + 1).padStart(2, '0')}`))
    expect(quiz.questions.map(q => q.prompt.split('\n')[0])).toEqual(labels.map(label => `### ${label}`))
    expect(validateV4Publication(quiz)).toEqual([])
    for (const q of quiz.questions) {
      expect(q.type).toBe('calculation')
      if (q.type !== 'calculation') throw new Error('Expected calculation')
      expect(q.drawing).toEqual({ width: 1200, height: 900 })
      expect(q.referenceAnswer.trim().length).toBeGreaterThan(0)
      expect(q.solution.trim().length).toBeGreaterThan(0)
      expect(q.rubric.length).toBeGreaterThan(0)
      for (const criterion of q.rubric) expect(criterion.description.trim().length).toBeGreaterThan(0)
      expect(q.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)).toBe(q.points)
      expect(q.prompt).not.toMatch(/[\u3400-\u9fff]/)
    }
  })

  it('preserves all eighteen prior source revisions and every one of 399 canonical contexts', () => {
    const sources = Object.entries(bundledQuizSources).filter(([file]) => !file.includes(`/${id}/`) && !file.includes('/digital-systems-ch4-textbook/') && !file.includes('/digital-systems-ch1-ch4-textbook-exercises/'))
      .map(([file, source]) => [file.split('/quizzes/')[1], source.replaceAll('\r\n', '\n')])
      .sort(([a], [b]) => a.localeCompare(b))
    expect(sources).toHaveLength(18)
    expect(sha(sources)).toBe('e53a0ddc129d3bf1d7191794e5c84d5d0023da1f1c642025c59441087acfd2f7')
    const prior = AI_QUIZ_CONTEXT.filter(c => c.quizId !== id && c.quizId !== 'digital-systems-ch4-textbook' && c.quizId !== 'digital-systems-ch1-ch4-textbook-exercises')
    expect(prior).toHaveLength(399)
    expect(sha(prior)).toBe('0139dcc36ac51cca4d15296a22b55fff06975636be4eef7a1a6a3a8c990470ea')
    expect(AI_QUIZ_CONTEXT).toHaveLength(504)
  })

  it('pins the released v1.26.0 historical source and all 423 historical contexts exactly', () => {
    const source = Object.entries(bundledQuizSources).find(([file]) => file.endsWith(`/${id}/v1.quiz.md`))![1]
      .replaceAll('\r\n', '\n').replace('current="false"', 'current="true"')
    expect(createHash('sha256').update(source).digest('hex'))
      .toBe('da4edd16d61b2b970f6f7e93efb504d43cc5eab83f8d4928e34799410ea8c938')
    const contexts = AI_QUIZ_CONTEXT.filter(c => !(c.quizId === id && c.revision === '2') && c.quizId !== 'digital-systems-ch4-textbook' && c.quizId !== 'digital-systems-ch1-ch4-textbook-exercises')
    expect(contexts).toHaveLength(423)
    expect(sha(contexts)).toBe('628792f2df6d3572b2c86d37ab6fb6e8717bdce7660b203f0884678da383ca07')
    const original = contexts.filter(c => c.quizId === id && c.revision === '1')
    expect(original).toHaveLength(24)
    expect(sha(original)).toBe('048bd08a86b2cfb838e985786daad905a88e3bae2d0d57025bfbcd5d86fb6b86')
    expect(validateV4Publication(historical)).toEqual([])
  })

  it('adds only the eleven source-derived tasks and preserves every other question field exactly', () => {
    expect(quiz.questions).toHaveLength(24)
    expect(historical.questions).toHaveLength(24)
    expect(Object.keys(tasks)).toEqual(['q01','q02','q03','q09','q14','q16','q18','q19','q21','q22','q24'])
    for (const [index, question] of quiz.questions.entries()) {
      const original = historical.questions[index]
      const task = tasks[question.id]
      expect(question.prompt).toBe(task
        ? original.prompt.replace('\n\n', `\n\n${task}\n\n`)
        : original.prompt)
      expect({ ...question, prompt: original.prompt }).toEqual(original)
    }
  })

  it.each(['1', '2'])('binds every revision %s context to its own exact quiz content and index', revision => {
    const selected = quizCatalog.getQuizRevision(id, revision)!
    const contexts = AI_QUIZ_CONTEXT.filter(c => c.quizId === id && c.revision === revision)
    expect(contexts).toHaveLength(24)
    expect(new Set(contexts.map(c => c.questionId)).size).toBe(24)
    for (const [index, q] of selected.questions.entries()) {
      if (q.type !== 'calculation') throw new Error('Expected calculation')
      expect(contexts.find(c => c.questionId === q.id)).toMatchObject({ quizId: id, revision, questionIndex: index,
        prompt: q.prompt, referenceAnswer: q.referenceAnswer, solution: q.solution,
        rubric: q.rubric, points: q.points, drawing: q.drawing })
    }
  })

  it('recomputes saved answers, all prime implicants, minimum covers, dont-cares and gate equations', () => {
    for (const revision of ['1', '2']) {
      const result = JSON.parse(execFileSync(process.execPath, ['scripts/audit-digital-systems-ch3.mjs', '--revision', revision], { encoding: 'utf8' }))
      expect(result).toMatchObject({ status: 'PASS', revision, questions: 24, checks: 510,
        primeImplicants: ["w'x", "w'z'", "x'z'", 'xy', 'xz', "yz'"] })
    }
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
