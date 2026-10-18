// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Markdown } from '../../components/Markdown'
import { requiresV4Draft } from '../../lib/draft-v4'
import { inspectQuiz, publicationErrors } from '../author/authoring-core'
import { toTutorContext } from '../../../scripts/ai-quiz-context'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { bundledQuizSources, quizCatalog } from './quiz-loader'

const id = 'discrete-math-ch8-inclusion-exclusion-examples'
const title = '離散數學第八章：包含及互斥原理－例題練習'
const source = Object.values(bundledQuizSources).find((value) => value.includes('id="discrete-math-ch8-inclusion-exclusion-examples"'))!
const quiz = quizCatalog.getQuizRevision(id, '1')!
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const unitHeadings = [
  '### 例題 8.1：選修大一作文與經濟學入門（投影片第 3–4 頁）',
  '### 兩個條件：不是 $3$ 或 $4$ 的倍數（投影片第 5 頁）',
  '### 三個條件：不是 $3$、$4$ 或 $5$ 的倍數（投影片第 7 頁）',
  '### Example 8.3：四個條件的包含及互斥公式（投影片第 9 頁）',
  '### 例題 8.4：不被 $2$、$3$ 或 $5$ 整除的正整數（投影片第 12–13 頁）',
  '### 十位數與個位數和為 $12$（投影片第 14 頁）',
  '### 三位數字和為 $22$（投影片第 15–16 頁）',
  '### Example 8.5：每個變數不超過 $7$ 的整數解（投影片第 17–19 頁）',
  '### 由 $4$ 元素集合到 $3$ 元素集合的映成函數（投影片第 20 頁）',
  '### Example 8.6：映成函數個數的一般公式（投影片第 21 頁）',
  '### 例題 8.7：不含 car、dog、pun、byte 的字母排列（投影片第 22–23 頁）',
  '### 不是完全平方數、立方數或四次方數（投影片第 24 頁）',
]
const question = (questionId: string) => quiz.questions.find((candidate) => candidate.id === questionId)!
const calculationQuestion = (questionId: string) => {
  const candidate = question(questionId)
  if (candidate.type !== 'calculation') throw new Error(`Expected ${questionId} to be a calculation question`)
  return candidate
}

afterEach(cleanup)

describe('Chapter 8 inclusion-exclusion examples', () => {
  it('publishes revision 1 with exactly 12 handwriting-capable calculations worth 90 points', () => {
    expect(quiz).toMatchObject({ id, revision: '1', current: true, title, subject: '離散數學', estimatedMinutes: 75 })
    expect(quiz.questions.map((item) => item.id)).toEqual(Array.from({ length: 12 }, (_, index) => 'q' + String(index + 1).padStart(2, '0')))
    expect(quiz.questions.reduce((sum, item) => sum + item.points, 0)).toBe(90)
    expect(quiz.questions.every((item) => item.type === 'calculation' && item.drawing?.width === 1200 && item.drawing.height === 900)).toBe(true)
    expect(quiz.questions.every((item) => item.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0) === item.points)).toBe(true)
    expect(new Set(quiz.questions.flatMap((item) => item.tags))).toEqual(new Set(quiz.tags))
    expect(quiz.tags).toEqual(['inclusion-exclusion', 'counting', 'divisibility', 'integer-solutions',
      'stars-and-bars', 'functions', 'onto', 'permutations'])
    expect(requiresV4Draft(quiz)).toBe(true)
    expect(publicationErrors(quiz)).toEqual([])
    expect(inspectQuiz(quiz)).toMatchObject({ questionCount: 12, totalDeclaredPoints: 90, deterministicMax: 0,
      calculationDrawingPoints: 90, questionTypes: { single: 0, multiple: 0, 'true-false': 0, fill: 0, calculation: 12, drawing: 0 } })
    expect(quizCatalog.getCurrentQuiz(id)).toBe(quiz)
    expect(quizCatalog.getQuizRevision(id, '2')).toBeNull()
    expect(quizCatalog.errors).toEqual([])
  })

  it('keeps the exact 12 source units and slide-page order without excluded 8.3 material', () => {
    expect(quiz.questions.map((item) => item.prompt.split('\n')[0])).toEqual(unitHeadings)
    expect(unitHeadings.map((heading) => Number(heading.match(/投影片第 ([\d–]+) 頁/)?.[1].split('–')[0])))
      .toEqual([3, 5, 7, 9, 12, 14, 15, 17, 20, 21, 22, 24])

    const publishedContent = quiz.questions.map((item) => {
      if (item.type !== 'calculation') throw new Error('Expected a calculation question')
      return [item.prompt, item.referenceAnswer, item.solution,
        ...item.rubric.map((criterion) => criterion.description)].join('\n')
    }).join('\n')
    expect(publishedContent).not.toMatch(/derangements|nothing is in its right place|錯排|重排|例題 8\.12|例題 8\.13|例題 8\.14|補充題/i)

    const ordinaryCalculationPrompts = quiz.questions.filter((item) => item.id !== 'q10').map((item) => item.prompt).join('\n')
    expect(ordinaryCalculationPrompts).not.toMatch(/請證明|證明|說明原理|解釋原理|為什麼|prove/i)
    expect(question('q10').prompt).toMatch(/推導/)
    expect(calculationQuestion('q04').referenceAnswer).toMatch(/4.*6.*4.*1/s)
    expect(question('q11').prompt).toContain('不必算出數值')
    expect(calculationQuestion('q11').referenceAnswer).toContain('26!')
    expect(calculationQuestion('q11').referenceAnswer).toContain('17!')
    expect(calculationQuestion('q11').referenceAnswer).toContain('[3(24!)+23!]')
    expect(calculationQuestion('q11').referenceAnswer).toContain('[3(22!)+3(21!)]')
    expect(calculationQuestion('q11').referenceAnswer).toContain('[20!+3(19!)]')
  })

  it.each(Array.from({ length: 12 }, (_, index) => 'q' + String(index + 1).padStart(2, '0')))(
    '%s renders without KaTeX errors and matches its canonical tutor context', (questionId) => {
      const item = question(questionId)
      expect(item.type).toBe('calculation')
      if (item.type !== 'calculation') throw new Error('Expected a calculation question')
      expect(item.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)).toBe(item.points)
      const content = [item.prompt, item.referenceAnswer, item.solution, ...item.rubric.map((criterion) => criterion.description)].join('\n\n')
      const { container } = render(<Markdown>{content}</Markdown>)
      expect(container.querySelector('.katex-error')).toBeNull()
      expect(container.querySelector('.katex')).not.toBeNull()
      const context = AI_QUIZ_CONTEXT.find((candidate) => candidate.quizId === id && candidate.revision === '1'
        && candidate.questionId === questionId)
      expect(context).toEqual(toTutorContext(quiz, item))
    },
  )

  it('renders all source formulas and keeps the Markdown renderer contract', () => {
    const formulas = [...source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)].map((match) => match[0])
    expect(formulas.length).toBeGreaterThan(0)
    const { container } = render(<Markdown>{formulas.join('\n\n')}</Markdown>)
    expect([...container.querySelectorAll('.katex-error')].map((error) => error.textContent)).toEqual([])
    expect(container.querySelectorAll('.katex')).toHaveLength(formulas.length)
    expect(source).not.toMatch(/^\s*\|.*\|\s*$/m)
    expect(source).not.toMatch(/<\/?(?:script|style|img|iframe|video|audio|svg|div|span)\b/i)
    for (const directive of ['question', 'drawing', 'answer', 'solution', 'rubric', 'end']) {
      expect(source.match(new RegExp('^:::' + directive + '\\b', 'gm'))).toHaveLength(12)
    }
  })

  it('adds 12 contexts and preserves the existing canonical context fingerprint', () => {
    const existing = AI_QUIZ_CONTEXT.filter((context) => context.quizId !== id)
    expect(AI_QUIZ_CONTEXT).toHaveLength(145)
    expect(existing).toHaveLength(133)
    expect(AI_QUIZ_CONTEXT.filter((context) => context.quizId === id && context.revision === '1')).toHaveLength(12)
    expect(sha(existing)).toBe('8b45ac7c7f2eb147a88d34ec15d51dc3a80439458772b29d33e1e42e50328e7d')
  })
})
