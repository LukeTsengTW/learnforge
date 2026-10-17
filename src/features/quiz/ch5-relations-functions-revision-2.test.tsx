// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Markdown } from '../../components/Markdown'
import { requiresV4Draft } from '../../lib/draft-v4'
import { inspectQuiz, publicationErrors } from '../author/authoring-core'
import { toTutorContext } from '../../../scripts/ai-quiz-context'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { bundledQuizSources, quizCatalog } from './quiz-loader'
vi.mock('./quiz-loader', async (importOriginal) => (await import('../../test-fixtures/fixture-quizzes.test-helper')).withFixtureQuizzes(await importOriginal<typeof import('./quiz-loader')>()))
vi.mock('../../../supabase/functions/_shared/quiz-context.generated', async (importOriginal) => (await import('../../test-fixtures/fixture-quizzes.test-helper')).withFixtureContexts(await importOriginal<typeof import('../../../supabase/functions/_shared/quiz-context.generated')>()))

const id = 'discrete-math-ch5-relations-functions-examples'
const title = '離散數學第五章：關係和函數－例題練習'
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const revision = (value: string) => {
  const quiz = quizCatalog.getQuizRevision(id, value)
  expect(quiz, `revision ${value} must be bundled`).not.toBeNull()
  return quiz!
}
const calculation = (value: string, questionId: string) => {
  const found = revision(value).questions.find((candidate) => candidate.id === questionId)
  if (found?.type !== 'calculation') throw new Error(`${value}/${questionId} must be a calculation question`)
  return found
}
const flat = (value: string) => value.replace(/\\begin\{aligned\}|\\end\{aligned\}|\\\\|&|\{\}|\\q?quad|\s+/g, '')

/** Revision 1 ids in source order; revision 2 drops q02 (例題 5.5) and q05 (定理 5.1) and renumbers the rest q01-q18. */
const removed = ['q02', 'q05']
const kept = Array.from({ length: 20 }, (_, index) => `q${String(index + 1).padStart(2, '0')}`).filter((old) => !removed.includes(old))
const renamed = (old: string) => `q${String(kept.indexOf(old) + 1).padStart(2, '0')}`

interface Simplified {
  /** Revision 1 id. */
  old: string
  /** The prompt now asks only for the result; these phrases of the old prompt are gone. */
  dropped: string[]
  /** Answers the reference answer must still contain. */
  answers: string[]
  /** Results the prompt must not give away. */
  hidden: string[]
}
/** Calculation-only questions: the prompt asks for the calculation and the answer, no explanation of principles (human decision). */
const simplified: Simplified[] = [
  { old: 'q01', dropped: ['說明 $A\\times B$ 與 $B\\times A$ 是否相等'], answers: ['A\\times B=\\{(2,4),(2,5),(3,4),(3,5),(4,4),(4,5)\\}', '$B^2=\\{(4,4),(4,5),(5,4),(5,5)\\}$'],
    hidden: ['(2,5)', '(5,5)', '\\ne'] },
  { old: 'q03', dropped: ['請說明理由'], answers: ['$|A\\times B|=3\\cdot2=6$', '$2^6=64$ 個', '$2^{mn}$ 個'], hidden: ['2^6', '64', '2^{mn}'] },
  { old: 'q07', dropped: ['並說明值域與對應域是否相等'], answers: ['值域為 $f(A)=\\{w,x\\}$', '$f(A)\\ne B$'], hidden: ['\\{w,x\\}', '\\ne'] },
  { old: 'q10', dropped: ['說明三者都是由 $A$ 到 $B$ 的函數'], answers: ['$f_1(A)=\\{x,y,z\\}=B$', '$f_2(A)=\\{x,y,z\\}=B$', '$g(A)=\\{x,y\\}\\ne B$'],
    hidden: ['f_1(A)', 'g(A)', '\\{x,y\\}'] },
  { old: 'q11', dropped: ['為什麼和的上限寫成', '為什麼這個數也等於', '講義也把同一個和寫成上限為'],
    answers: ['=16384-8748+768-4=8400', '$w$ 裝 $3,4$；$x$ 裝 $1$；$y$ 裝 $2$；$z$ 裝 $5,6,7$'], hidden: ['8400', '16384', '8748', '\\{3,4\\}'] },
  { old: 'q12', dropped: ['請說明「相同容器」與「不同容器」兩種情形的方法數之間有什麼關係'], answers: ['=\\frac{8400}{24}=350'], hidden: ['350', '8400', '4!'] },
  { old: 'q13', dropped: ['說明它與 (a) 的關係'], answers: ['=81-48+3=36', '\\frac{36}{6}=6'], hidden: ['36', '81', '3!'] },
  { old: 'q20', dropped: ['對下列六種情形，各寫出'], answers: ['(1) $n^m=3^4=81$', '(5) $\\binom{n+m-1}{m}$；$\\binom{6}{4}=15$', '(6) $\\binom{m-1}{n-1}$；$\\binom{3}{2}=3$'],
    hidden: ['81', '\\binom{6}{4}', 'n^m'] },
]
const unchanged = kept.filter((old) => !simplified.some((item) => item.old === old))
/** Phrases that ask for an explanation of principles; none may remain in a simplified prompt. */
const explain = /說明|理由|為什麼|原因/

afterEach(cleanup)

describe('Chapter 5 relations and functions practice, revision 2 (v1.16.1)', () => {
  it('is the current revision with 18 handwriting-capable calculations worth 136 points', () => {
    const value = revision('2')
    expect(value).toMatchObject({ id, revision: '2', current: true, title, subject: '離散數學', estimatedMinutes: 100 })
    expect(value.tags).toEqual(revision('1').tags)
    expect(value.description).toContain('依頁次整理 18 道例題與示範推導')
    expect(value.description).toContain('計算題請寫出計算過程與答案')
    expect(value.description).not.toContain('並說明所用的定義、公式或原理')
    expect(value.questions.map((q) => q.id)).toEqual(Array.from({ length: 18 }, (_, index) => `q${String(index + 1).padStart(2, '0')}`))
    expect(value.questions.map((q) => q.points)).toEqual(kept.map((old) => calculation('1', old).points))
    expect(value.questions.reduce((sum, q) => sum + q.points, 0)).toBe(136)
    expect(value.questions.every((q) => q.type === 'calculation' && q.drawing?.width === 1200 && q.drawing.height === 900)).toBe(true)
    expect(new Set(value.questions.flatMap((q) => q.tags))).toEqual(new Set(value.tags))
    expect(requiresV4Draft(value)).toBe(true)
    expect(publicationErrors(value)).toEqual([])
    expect(inspectQuiz(value)).toMatchObject({ questionCount: 18, totalDeclaredPoints: 136, deterministicMax: 0, calculationDrawingPoints: 136,
      questionTypes: { single: 0, multiple: 0, 'true-false': 0, fill: 0, calculation: 18, drawing: 0 } })
    expect(quizCatalog.getCurrentQuiz(id)).toBe(value)
    expect(revision('1').current).toBe(false)
  })

  it('drops exactly 例題 5.5 and 定理 5.1 and keeps every other unit in source order', () => {
    const heading = (q: { prompt: string }) => q.prompt.split('\n')[0]
    const oldHeadings = revision('1').questions.map(heading)
    expect(removed.map((old) => heading(calculation('1', old)))).toEqual([
      '### 例題 5.5：由 A 到 B 的關係（講義第 3 頁）', '### 定理 5.1：叉積對交集與聯集的分配律（講義第 6 頁）'])
    expect(revision('2').questions.map(heading)).toEqual(oldHeadings.filter((_, index) => !removed.includes(`q${String(index + 1).padStart(2, '0')}`)))
    const all = revision('2').questions.map((q) => calculation('2', q.id)).map((q) => [q.prompt, q.referenceAnswer, q.solution].join('\n')).join('\n')
    for (const gone of ['例題 5.5', '定理 5.1', '（講義第 3 頁）', '（講義第 6 頁）']) expect(all).not.toContain(gone)
  })

  it.each(unchanged)('%s (proof, derivation or judgment) is carried over unchanged apart from its id', (old) => {
    const before = calculation('1', old)
    const after = calculation('2', renamed(old))
    expect({ ...after, id: old }).toEqual(before)
  })

  it.each(simplified)('$old asks only for the calculation and the answer', (item) => {
    const before = calculation('1', item.old)
    const after = calculation('2', renamed(item.old))
    expect(after.points).toBe(before.points)
    expect(after.tags).toEqual(before.tags)
    expect(after.prompt.split('\n')[0]).toBe(before.prompt.split('\n')[0])
    for (const phrase of item.dropped) {
      expect(before.prompt, phrase).toContain(phrase)
      expect(after.prompt, phrase).not.toContain(phrase)
    }
    expect(after.prompt.split('\n').slice(1).join('\n')).not.toMatch(explain)
    for (const result of item.hidden) expect(flat(after.prompt), result).not.toContain(flat(result))
    for (const answer of item.answers) expect(flat(after.referenceAnswer), answer).toContain(flat(answer))
    expect(after.solution).toBe(before.solution)
    expect(after.rubric.reduce((sum, r) => sum + r.score!, 0)).toBe(after.points)
    expect(after.rubric.every((r) => r.score !== null && Number.isInteger(r.score) && r.score > 0 && !explain.test(r.description))).toBe(true)
  })

  it.each(Array.from({ length: 18 }, (_, index) => `q${String(index + 1).padStart(2, '0')}`))('%s renders with KaTeX and has its canonical context', (questionId) => {
    const value = revision('2')
    const q = calculation('2', questionId)
    expect(q.hint).toBeNull()
    expect(q.rubric.reduce((sum, r) => sum + r.score!, 0)).toBe(q.points)
    const content = [q.prompt, q.referenceAnswer, q.solution, ...q.rubric.map((r) => r.description)].join('\n\n')
    const { container } = render(<Markdown>{content}</Markdown>)
    expect(container.querySelector('.katex-error')).toBeNull()
    const prose = container.cloneNode(true) as HTMLElement
    prose.querySelectorAll('.katex').forEach((math) => math.remove())
    expect(prose.textContent).not.toMatch(/\$|\\[a-zA-Z]|[{}_^]/)
    const context = AI_QUIZ_CONTEXT.find((c) => String(c.quizId) === id && String(c.revision) === '2' && String(c.questionId) === questionId)
    expect(context).toEqual(toTutorContext(value, q))
  })

  it('renders every formula of the revision 2 source and keeps it free of Markdown tables and HTML', () => {
    const source = Object.values(bundledQuizSources).find((candidate) => candidate.includes(`id="${id}" revision="2"`))!
    const formulas = [...source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)].map((match) => match[0])
    expect(formulas.length).toBeGreaterThan(900)
    const { container } = render(<Markdown>{formulas.join('\n\n')}</Markdown>)
    expect([...container.querySelectorAll('.katex-error')].map((error) => error.textContent)).toEqual([])
    expect(container.querySelectorAll('.katex')).toHaveLength(formulas.length)
    expect(source).not.toMatch(/^\s*\|.*\|\s*$/m)
    expect(source).not.toMatch(/<\/?[a-zA-Z][^>]*>/)
    for (const directive of ['question', 'drawing', 'answer', 'solution', 'rubric', 'end']) {
      expect(source.match(new RegExp(`^:::${directive}\\b`, 'gm'))).toHaveLength(18)
    }
  })

  it('leaves revision 1 and its 20 contexts as they were published in v1.16.0, apart from the current flag', () => {
    const before = revision('1')
    expect(sha({ ...before, current: true })).toBe('cf13efa71e411a77bfcce808841c62c7a05ced8669baeb72db4bb3042b87bf36')
    expect(sha(AI_QUIZ_CONTEXT.filter((c) => String(c.quizId) === id && String(c.revision) === '1'))).toBe('2cb13e1757b76a036835bbda0a8fd143c09ca39160147a4110b6f813e833af42')
  })
})
