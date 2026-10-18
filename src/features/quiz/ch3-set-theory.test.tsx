// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Markdown } from '../../components/Markdown'
import { parseQuiz } from '../../lib/quiz-parser'
import { requiresV4Draft } from '../../lib/draft-v4'
import { inspectQuiz, publicationErrors } from '../author/authoring-core'
import { toTutorContext } from '../../../scripts/ai-quiz-context'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { bundledQuizSources, quizCatalog } from './quiz-loader'
vi.mock('./quiz-loader', async (importOriginal) => (await import('../../test-fixtures/fixture-quizzes.test-helper')).withFixtureQuizzes(await importOriginal<typeof import('./quiz-loader')>()))
vi.mock('../../../supabase/functions/_shared/quiz-context.generated', async (importOriginal) => (await import('../../test-fixtures/fixture-quizzes.test-helper')).withFixtureContexts(await importOriginal<typeof import('../../../supabase/functions/_shared/quiz-context.generated')>()))

const id = 'discrete-math-ch3-set-theory-examples'
const title = '離散數學第三章：集合論－例題練習'
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
/**
 * v1.13.0 edited discrete-math-exercises-2026/1 in place: every 講義 became 習題解答 and nothing else changed. Reversing
 * exactly that wording must reproduce the fingerprints this file pinned for the earlier inventory in v1.10.0.
 */
const beforeExercisesWordingEdit = (value: unknown) => JSON.parse(JSON.stringify(value)
  .replace('依據 2026 年度五份習題解答（Chapter 1、3、5、7、8）整理全部 13 道習題，題號與小題標號沿用原習題解答，',
    () => '依據 2026 年度五份習題解答講義（Chapter 1、3、5、7、8）整理全部 13 道習題，題號與小題標號沿用原講義，')
  .replaceAll('習題解答的答案為 $63$', () => '講義答案為 $63$')
  .replaceAll('本題以習題解答的答案 $63$ 為準', () => '本題以講義答案 $63$ 為準')
  .replaceAll('（習題解答只收錄原題的', () => '（講義只收錄原題的')
  .replaceAll('習題解答另外用三層迴圈', () => '講義另外用三層迴圈')
  .replace(/（(Ch\d) 習題解答第 ([\d–]+) 頁）/g, (_, chapter: string, pages: string) => `（${chapter} 講義第 ${pages} 頁）`))
const quiz = () => {
  const value = quizCatalog.getQuizRevision(id, '1')
  expect(value, 'the Chapter 3 family must be bundled').not.toBeNull()
  return value!
}

/** Long formulas are broken over several lines; compare them without the aligned scaffolding and whitespace. */
const flat = (value: string) => value.replace(/\\begin\{aligned\}|\\end\{aligned\}|\\\\|&|\{\}|\\q?quad|\s+/g, '')

interface Example {
  id: string
  points: number
  /** Source label in the heading, before the full-width colon. */
  source: string
  /** Pages of the 24-page handout that hold the worked example. */
  pages: number[]
  /** Subpart labels; only q06, q08 and q13 are labelled in the handout itself. */
  parts: string[]
  /** Statement fragments that must survive, including every set, overline and operator. */
  statement: string[]
  answers: string[]
  /** Results worked out on the slide that the prompt must not give away. */
  hidden: string[]
}
const subsetsOf4 = ['\\emptyset', '\\{1\\}', '\\{2\\}', '\\{3\\}', '\\{4\\}', '\\{1,2\\}', '\\{1,3\\}', '\\{1,4\\}', '\\{2,3\\}', '\\{2,4\\}',
  '\\{3,4\\}', '\\{1,2,3\\}', '\\{1,2,4\\}', '\\{1,3,4\\}', '\\{2,3,4\\}', '\\{1,2,3,4\\}']
const dualSources = [
  '\\mathscr{U}=(A\\cap B)\\cup(A\\cap\\overline{B})\\cup(\\overline{A}\\cap B)\\cup(\\overline{A}\\cap\\overline{B})',
  'A=A\\cap(A\\cup B)',
  'A\\cup B=(A\\cap B)\\cup(A\\cap\\overline{B})\\cup(\\overline{A}\\cap B)',
  'A=(A\\cup B)\\cap(A\\cup\\emptyset)',
]
const dualAnswers = [
  '\\emptyset=(A\\cup B)\\cap(A\\cup\\overline{B})\\cap(\\overline{A}\\cup B)\\cap(\\overline{A}\\cup\\overline{B})',
  'A=A\\cup(A\\cap B)',
  'A\\cap B=(A\\cup B)\\cap(A\\cup\\overline{B})\\cap(\\overline{A}\\cup B)',
  'A=(A\\cap B)\\cup(A\\cap\\mathscr{U})',
]
const threeSets = '|A\\cup B\\cup C|=|A|+|B|+|C|-|A\\cap B|-|A\\cap C|-|B\\cap C|+|A\\cap B\\cap C|'
const examples: Example[] = [
  { id: 'q01', points: 10, source: '例題 3.1', pages: [2, 3], parts: ['(a)', '(b)', '(c)'],
    statement: ['令 $A$ 是由前五個正整數所組成的集合', '$2$ 與 $6$ 是否為 $A$ 的元素', '$\\{x\\mid 1\\le x\\le5\\}$', '宇集 $\\mathscr{U}$',
      '「所有整數」', '「所有正整數」', '「所有實數」', '「所有偶數」'],
    answers: ['A=\\{1,2,3,4,5\\}', '$2\\in A$', '$6\\notin A$', 'A=\\{x\\mid x\\text{ 為整數且 }1\\le x\\le5\\}', '$\\{1,2,3,4,5\\}=A$', '$\\{2,4\\}$'],
    hidden: ['\\{1,2,3,4,5\\}', '\\{2,4\\}', '為整數且', '2\\in A', '6\\notin A'] },
  { id: 'q02', points: 6, source: '基數例', pages: [4], parts: ['(a)', '(b)'],
    statement: ['基數（cardinality）', '大小（size）', '(a) $A=\\{1,4,9,16\\}$', '(b) $A=\\{2,4,6,8,10\\}$'],
    answers: ['(a) $|A|=4$', '(b) $|A|=5$'],
    hidden: ['|A|=4', '|A|=5', '元素的個數'] },
  { id: 'q03', points: 16, source: '例題 3.7', pages: [6], parts: ['(a)', '(b)', '(c)', '(d)'],
    statement: ['$C=\\{1,2,3,4\\}$', '$C$ 共有多少個子集合', '由 $C$ 取兩個元素所構成的子集合', '$k=0,1,2,3,4$', '二項式係數的和', '列出 $C$ 的所有子集合'],
    answers: ['(a) $2^4=16$', '(b) $\\binom{4}{2}=6$', '$1,4,6,4,1$', '2^4=\\sum_{k=0}^{4}\\binom{4}{k}=1+4+6+4+1=16',
      ...subsetsOf4.map((subset) => `$${subset}$`)],
    hidden: ['2^4', '16', '\\binom', '\\{1,2\\}', '\\emptyset'] },
  { id: 'q04', points: 10, source: '證明例', pages: [7], parts: [],
    statement: ['對任一正整數 $n$', '\\binom{n}{0}+\\binom{n}{1}+\\binom{n}{2}+\\cdots+\\binom{n}{n}=2^n', '二項式定理（定理 1.1）',
      '(x+y)^n=\\sum_{k=0}^{n}\\binom{n}{k}x^ky^{n-k}'],
    answers: ['令 $x=1$、$y=1$', '2^n=(1+1)^n=\\sum_{k=0}^{n}\\binom{n}{k}1^k1^{n-k}', '=\\binom{n}{0}+\\binom{n}{1}+\\cdots+\\binom{n}{n}'],
    hidden: ['x=1', 'y=1', '(1+1)^n'] },
  { id: 'q05', points: 8, source: '冪集合例', pages: [8], parts: [],
    statement: ['冪集合（power set）$\\mathcal{P}(A)$', '$A$ 的所有子集合所成的集合', '$A=\\{1,2,3\\}$'],
    answers: ['\\mathcal{P}(A)=\\{\\emptyset,\\{1\\},\\{2\\},\\{3\\},\\{1,2\\},\\{1,3\\},\\{2,3\\},\\{1,2,3\\}\\}', '$2^3=8$'],
    hidden: ['\\{1,2\\}', '\\{1\\}', '\\emptyset', '2^3'] },
  { id: 'q06', points: 16, source: '例題 3.15', pages: [10], parts: ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)'],
    statement: ['$\\mathscr{U}=\\{1,2,3,\\ldots,9,10\\}$', '$A=\\{1,2,3,4,5\\}$', '$B=\\{3,4,5,6,7\\}$', '$C=\\{7,8,9\\}$',
      '(a) $A\\cap B$', '(b) $A\\cup B$', '(c) $B\\cap C$', '(d) $A\\cap C$', '(e) $A\\mathbin{\\triangle}B$', '(f) $A\\cup C$',
      '(g) $A\\mathbin{\\triangle}C$', 'A\\mathbin{\\triangle}B=\\{x\\mid x\\in A\\cup B\\land x\\notin A\\cap B\\}'],
    answers: ['(a) $A\\cap B=\\{3,4,5\\}$', '(b) $A\\cup B=\\{1,2,3,4,5,6,7\\}$', '(c) $B\\cap C=\\{7\\}$', '(d) $A\\cap C=\\emptyset$',
      '(e) $A\\mathbin{\\triangle}B=\\{1,2,6,7\\}$', '(f) $A\\cup C=\\{1,2,3,4,5,7,8,9\\}$', '(g) $A\\mathbin{\\triangle}C=\\{1,2,3,4,5,7,8,9\\}$'],
    hidden: ['\\{3,4,5\\}', '\\{1,2,3,4,5,6,7\\}', '\\{7\\}', '\\emptyset', '\\{1,2,6,7\\}', '\\{1,2,3,4,5,7,8,9\\}'] },
  { id: 'q07', points: 16, source: '證明例', pages: [15], parts: [],
    statement: ['宇集 $\\mathscr{U}$ 的任意集合 $A$、$B$', 'De Morgan 定律', '\\overline{A\\cup B}=\\overline{A}\\cap\\overline{B}',
      '$\\{x\\mid x\\in\\mathscr{U}\\land x\\notin A\\}$', '依定義 3.2', '$C\\subseteq D$ 且 $D\\subseteq C$'],
    answers: ['x\\in\\overline{A\\cup B}\\Rightarrow x\\notin A\\cup B', '\\Rightarrow x\\notin A\\text{ and }x\\notin B',
      '\\Rightarrow x\\in\\overline{A}\\text{ and }x\\in\\overline{B}', '\\Rightarrow x\\in\\overline{A}\\cap\\overline{B}',
      '$\\overline{A\\cup B}\\subseteq\\overline{A}\\cap\\overline{B}$', '$\\overline{A}\\cap\\overline{B}\\subseteq\\overline{A\\cup B}$',
      '由定義 3.2 得 $\\overline{A\\cup B}=\\overline{A}\\cap\\overline{B}$'],
    hidden: ['\\Rightarrow', 'x\\notin A\\cup B', '\\text{ and }', '\\overline{A}\\cap\\overline{B}\\subseteq'] },
  { id: 'q08', points: 12, source: 'Exercise 3.2 第 11 題', pages: [16], parts: ['(a)', '(b)', '(c)', '(d)'],
    statement: ['**11.** Write the dual statement for each of the following set-theoretic results.', ...dualSources, '依定義 3.9',
      '將每一個 $\\emptyset$ 及 $\\mathscr{U}$ 分別取代為 $\\mathscr{U}$ 及 $\\emptyset$', '將每一個 $\\cap$ 及 $\\cup$ 分別取代為 $\\cup$ 及 $\\cap$'],
    answers: dualAnswers, hidden: dualAnswers },
  { id: 'q09', points: 6, source: '對偶原理例', pages: [17], parts: [],
    statement: ['A=A\\cap(A\\cup B)', '是一個定理', '對偶原理（定理 3.5）'],
    answers: ['A=A\\cup(A\\cap B)', '亦為一個定理'], hidden: ['A=A\\cup(A\\cap B)'] },
  { id: 'q10', points: 8, source: '例題 3.25', pages: [20], parts: [],
    statement: ['在一個 $50$ 位大一新生的班級上', '有 $30$ 位學習 C++', '$25$ 位學習 Java', '且有 $10$ 位兩種語言均學習',
      '試問有多少位大一新生學習 C++ 或 Java？'],
    answers: ['共 $45$ 位', '$|A\\cup B|=|A|+|B|-|A\\cap B|=30+25-10=45$'], hidden: ['45', '55', '|A\\cap B|', '|A\\cup B|'] },
  { id: 'q11', points: 10, source: '計數例', pages: [21], parts: [],
    statement: ['在字元 $0,1,2,\\ldots,9$ 的排列中', '以 $3$ 開頭或以 $7$ 結尾的排列共有多少個？'],
    answers: ['共 $685{,}440$ 個', '$|A\\cup B|=|A|+|B|-|A\\cap B|=9!+9!-8!=685{,}440$'], hidden: ['9!', '8!', '685', '|A\\cap B|'] },
  { id: 'q12', points: 18, source: '推導例', pages: [22], parts: [],
    statement: ['利用二個集合的公式', '|A\\cup B|=|A|+|B|-|A\\cap B|', '三個有限集合 $A$、$B$、$C$', '$|A\\cup B\\cup C|$'],
    answers: [threeSets], hidden: ['|A\\cap B\\cap C|', '|B\\cap C|', '|A\\cap C|', '(B\\cup C)'] },
  { id: 'q13', points: 14, source: '計數例', pages: [23], parts: ['(a)', '(b)', '(c)'],
    statement: ['求 $|A\\cup B\\cup C|$', '$|A|=50$', '$|B|=500$', '$|C|=5000$', '(a) $A\\subseteq B\\subseteq C$',
      '(b) $A\\cap B=A\\cap C=B\\cap C=\\emptyset$', '(c) $|A\\cap B|=|A\\cap C|=|B\\cap C|=3$ 且 $|A\\cap B\\cap C|=1$'],
    answers: ['(a) $|A\\cup B\\cup C|=|C|=5000$', '(b) $50+500+5000=5550$', '(c) $50+500+5000-3-3-3+1=5542$'],
    hidden: ['5550', '5542', '=|C|', '-3-3-3'] },
]
/** Every page that is not a worked example, with the reason it is left out. */
const excludedPages: Record<number, string> = {
  1: 'chapter title', 5: 'definition 3.2 and proper subset', 9: 'definition 3.5 with illustrative Venn diagrams', 11: 'definition 3.6',
  12: 'definitions 3.7 and 3.8 with illustrative Venn diagrams', 13: 'laws of set theory 1-5', 14: 'laws of set theory 6-10',
  18: 'Figure 3.6, illustrative Venn diagrams', 19: 'Figure 3.7, illustrative Venn diagrams', 24: 'closing page',
}
const question = (questionId: string) => {
  const found = quiz().questions.find((candidate) => candidate.id === questionId)
  if (found?.type !== 'calculation') throw new Error(`${questionId} must be a calculation question`)
  return found
}
const pageLabel = (pages: number[]) => `（講義第 ${pages.join('–')} 頁）`

afterEach(cleanup)

describe('PDF-backed Chapter 3 set theory practice', () => {
  it('bundles a separate current family of 13 handwriting-capable calculations worth 150 points', () => {
    const value = quiz()
    expect(value).toMatchObject({ id, revision: '1', current: true, title, subject: '離散數學', estimatedMinutes: 120 })
    expect(value.tags).toEqual(['sets', 'subsets', 'power-set', 'set-operations', 'set-laws', 'duality', 'de-morgan', 'venn-diagram',
      'inclusion-exclusion'])
    expect(value.questions.map((q) => q.id)).toEqual(examples.map((example) => example.id))
    expect(new Set(value.questions.map((q) => q.id)).size).toBe(13)
    expect(value.questions.map((q) => q.points)).toEqual(examples.map((example) => example.points))
    expect(value.questions.reduce((sum, q) => sum + q.points, 0)).toBe(150)
    expect(value.questions.every((q) => q.type === 'calculation' && q.drawing?.width === 1200 && q.drawing.height === 900)).toBe(true)
    expect(value.questions.every((q) => q.tags.length > 0 && q.tags.every((tag) => value.tags.includes(tag)))).toBe(true)
    expect(new Set(value.questions.flatMap((q) => q.tags))).toEqual(new Set(value.tags))
    expect(requiresV4Draft(value)).toBe(true)
    expect(publicationErrors(value)).toEqual([])
    expect(inspectQuiz(value)).toMatchObject({ questionCount: 13, totalDeclaredPoints: 150, deterministicMax: 0,
      calculationDrawingPoints: 150, questionTypes: { single: 0, multiple: 0, 'true-false': 0, fill: 0, calculation: 13, drawing: 0 } })
    expect(quizCatalog.getCurrentQuiz(id)).toBe(value)
    expect(quizCatalog.getQuizRevision(id, '2')).toBeNull()
  })

  it.each(examples)('$id keeps the source statement, subparts and an answer-free prompt', (example) => {
    const q = question(example.id)
    const heading = q.prompt.split('\n')[0]
    expect(heading.startsWith(`### ${example.source}：`)).toBe(true)
    expect(heading.endsWith(pageLabel(example.pages))).toBe(true)
    for (const fragment of example.statement) expect(flat(q.prompt), fragment).toContain(flat(fragment))
    for (const part of example.parts) expect(q.prompt).toContain(`\n${part}`)
    expect(q.prompt.match(/^\([a-z]\)/gm) ?? []).toEqual(example.parts)
    for (const result of example.hidden) expect(flat(q.prompt), result).not.toContain(flat(result))
    expect(q.prompt).not.toMatch(/Ans\s*[.:]|Answer\s*:|答案是|解法/i)
  })

  it.each(examples)('$id has the verified answer, a worked solution, a scored rubric, rendered math and canonical context', (example) => {
    const value = quiz()
    const q = question(example.id)
    for (const answer of example.answers) expect(flat(q.referenceAnswer), answer).toContain(flat(answer))
    expect(q.solution.length).toBeGreaterThan(q.referenceAnswer.length)
    expect(q.hint).toBeNull()
    expect(q.rubric.length).toBeGreaterThanOrEqual(3)
    expect(q.rubric.every((r) => r.score !== null && Number.isInteger(r.score) && r.score > 0 && r.description.length > 0)).toBe(true)
    expect(q.rubric.reduce((sum, r) => sum + r.score!, 0)).toBe(example.points)
    for (const part of example.parts) {
      expect(q.rubric.some((r) => r.description.startsWith(part)), `rubric for ${part}`).toBe(true)
      expect(q.referenceAnswer, `answer for ${part}`).toContain(part)
      expect(q.solution, `solution for ${part}`).toContain(`**${part}**`)
    }
    const content = [q.prompt, q.referenceAnswer, q.solution, ...q.rubric.map((r) => r.description)].join('\n\n')
    expect(content).not.toContain(':::')
    const { container } = render(<Markdown>{content}</Markdown>)
    expect(container.querySelector('.katex-error')).toBeNull()
    expect(container.querySelector('.katex')).not.toBeNull()
    const prose = container.cloneNode(true) as HTMLElement
    prose.querySelectorAll('.katex').forEach((math) => math.remove())
    expect(prose.textContent).not.toMatch(/\$|\\[a-zA-Z]|[{}_^]/)
    const context = AI_QUIZ_CONTEXT.find((c) => String(c.quizId) === id && String(c.questionId) === example.id)
    expect(context).toEqual(toTutorContext(value, q))
  })

  it('maps every page of the 24-page handout: 13 worked examples in source order, none omitted, none invented', () => {
    const included = examples.flatMap((example) => example.pages)
    expect(included).toEqual([2, 3, 4, 6, 7, 8, 10, 15, 16, 17, 20, 21, 22, 23])
    expect(new Set(included).size).toBe(included.length)
    const excluded = Object.keys(excludedPages).map(Number)
    expect(excluded.filter((page) => included.includes(page))).toEqual([])
    expect([...included, ...excluded].sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1))
    const headings = quiz().questions.map((q) => q.prompt.split('\n')[0])
    expect(headings).toHaveLength(examples.length)
    expect(headings.map((heading) => heading.replace(/^### /, '').replace(/：.*$/, ''))).toEqual(examples.map((example) => example.source))
    expect(headings.map((heading) => /（講義第 ([\d–]+) 頁）$/.exec(heading)?.[1])).toEqual(examples.map((example) => example.pages.join('–')))
    const source = Object.values(bundledQuizSources).find((candidate) => candidate.includes(`id="${id}"`))!
    for (const directive of ['question', 'drawing', 'answer', 'solution', 'rubric', 'end']) {
      expect(source.match(new RegExp(`^:::${directive}\\b`, 'gm'))).toHaveLength(13)
    }
    expect(source).not.toMatch(/^:::hint\b/m)
    expect(source.match(/^width=1200\r?\nheight=900\r?$/gm)).toHaveLength(13)
  })

  it('recomputes the finite-set answers instead of trusting the slide', () => {
    const tex = (set: number[]) => (set.length ? `\\{${set.join(',')}\\}` : '\\emptyset')
    const subsets = (items: number[]) => Array.from({ length: 2 ** items.length }, (_, mask) => items.filter((_, index) => mask & (1 << index)))
      .sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()))
    const answer = (questionId: string) => flat(question(questionId).referenceAnswer)

    // q02: cardinalities.
    expect(new Set([1, 4, 9, 16]).size).toBe(4)
    expect(new Set([2, 4, 6, 8, 10]).size).toBe(5)

    // q03: subsets of C, by size, and the full list.
    const ofC = subsets([1, 2, 3, 4])
    expect(ofC).toHaveLength(2 ** 4)
    expect([0, 1, 2, 3, 4].map((size) => ofC.filter((subset) => subset.length === size).length)).toEqual([1, 4, 6, 4, 1])
    expect(ofC.map(tex)).toEqual(subsetsOf4)
    for (const subset of ofC) expect(question('q03').referenceAnswer).toContain(`$${tex(subset)}$`)

    // q05: the power set, written in the same order.
    const ofA = subsets([1, 2, 3])
    expect(ofA).toHaveLength(2 ** 3)
    expect(answer('q05')).toContain(flat(`\\mathcal{P}(A)=\\{${ofA.map(tex).join(',')}\\}`))

    // q06: every operation of Example 3.15, element by element.
    const [A, B, C] = [[1, 2, 3, 4, 5], [3, 4, 5, 6, 7], [7, 8, 9]]
    const union = (x: number[], y: number[]) => [...new Set([...x, ...y])].sort((a, b) => a - b)
    const intersection = (x: number[], y: number[]) => x.filter((item) => y.includes(item))
    const symmetric = (x: number[], y: number[]) => union(x, y).filter((item) => !intersection(x, y).includes(item))
    const computed = [`A\\cap B=${tex(intersection(A, B))}`, `A\\cup B=${tex(union(A, B))}`, `B\\cap C=${tex(intersection(B, C))}`,
      `A\\cap C=${tex(intersection(A, C))}`, `A\\mathbin{\\triangle}B=${tex(symmetric(A, B))}`, `A\\cup C=${tex(union(A, C))}`,
      `A\\mathbin{\\triangle}C=${tex(symmetric(A, C))}`]
    computed.forEach((result, index) => expect(question('q06').referenceAnswer).toContain(`(${'abcdefg'[index]}) $${result}$`))

    // q10, q11, q13: the two- and three-set counts.
    const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))
    expect(30 + 25 - 10).toBe(45)
    expect(answer('q10')).toContain('=30+25-10=45')
    expect(factorial(9) + factorial(9) - factorial(8)).toBe(685440)
    expect(answer('q11')).toContain('=9!+9!-8!=685{,}440')
    const three = (a: number, b: number, c: number, ab: number, ac: number, bc: number, abc: number) => a + b + c - ab - ac - bc + abc
    expect(three(50, 500, 5000, 50, 50, 500, 50)).toBe(5000)
    expect(three(50, 500, 5000, 0, 0, 0, 0)).toBe(5550)
    expect(three(50, 500, 5000, 3, 3, 3, 1)).toBe(5542)
  })

  it('checks the identities behind the proofs and the dual statements over every choice of sets', () => {
    // q04: the sum of a row of binomial coefficients.
    for (let n = 1; n <= 30; n++) {
      let coefficient = 1
      let total = 0
      for (let k = 0; k <= n; k++) { total += coefficient; coefficient = coefficient * (n - k) / (k + 1) }
      expect(total).toBe(2 ** n)
    }
    // Sets are bit masks over a small universe; ~x is the complement inside it.
    const bits = (mask: number) => mask.toString(2).split('1').length - 1
    const U = 0b111
    for (let a = 0; a <= U; a++) for (let b = 0; b <= U; b++) {
      const [na, nb] = [~a & U, ~b & U]
      // q07: De Morgan.
      expect(~(a | b) & U).toBe(na & nb)
      // q08: each source statement and its dual.
      expect((a & b) | (a & nb) | (na & b) | (na & nb)).toBe(U)
      expect((a | b) & (a | nb) & (na | b) & (na | nb)).toBe(0)
      expect(a & (a | b)).toBe(a)
      expect(a | (a & b)).toBe(a)
      expect((a & b) | (a & nb) | (na & b)).toBe(a | b)
      expect((a | b) & (a | nb) & (na | b)).toBe(a & b)
      expect((a | b) & (a | 0)).toBe(a)
      expect((a & b) | (a & U)).toBe(a)
    }
    // q12: the three-set formula and the two facts its derivation uses.
    const V = 0b1111
    for (let a = 0; a <= V; a++) for (let b = 0; b <= V; b++) for (let c = 0; c <= V; c++) {
      expect(a & (b | c)).toBe((a & b) | (a & c))
      expect((a & b) & (a & c)).toBe(a & b & c)
      expect(bits(a | b | c)).toBe(bits(a) + bits(b) + bits(c) - bits(a & b) - bits(a & c) - bits(b & c) + bits(a & b & c))
    }
    // q08 and q09: a dual is the source with intersection and union swapped and the empty set and universe swapped; nothing else moves.
    const swap: Record<string, string> = { '\\cap': '\\cup', '\\cup': '\\cap', '\\emptyset': '\\mathscr{U}', '\\mathscr{U}': '\\emptyset' }
    const dual = (statement: string) => statement.replace(/\\cap|\\cup|\\emptyset|\\mathscr\{U\}/g, (symbol) => swap[symbol] ?? symbol)
    expect(dualSources.map(dual)).toEqual(dualAnswers)
    expect(dualAnswers.map(dual)).toEqual(dualSources)
    dualSources.forEach((statement, index) => {
      expect(flat(question('q08').prompt)).toContain(flat(statement))
      expect(flat(question('q08').referenceAnswer)).toContain(flat(dual(statement)))
      expect(flat(question('q08').rubric[index].description)).toContain(flat(dual(statement)))
    })
    expect(flat(question('q09').prompt)).toContain(flat(dualSources[1]))
    expect(flat(question('q09').referenceAnswer)).toContain(flat(dual(dualSources[1])))
    // The overlines of the source survive in every part that has them.
    const overlines = (text: string) => text.match(/\\overline\{[^}]*\}/g) ?? []
    expect(dualSources.map((statement) => overlines(statement).length)).toEqual([4, 0, 2, 0])
    expect(dualAnswers.map((statement) => overlines(statement))).toEqual(dualSources.map((statement) => overlines(statement)))
    expect(overlines(question('q07').prompt)).toEqual(['\\overline{A\\cup B}', '\\overline{A}', '\\overline{B}', '\\overline{A}'])
  })

  it('scales points with the amount of work instead of giving every example the same score', () => {
    const points = (questionId: string) => question(questionId).points
    expect(new Set(quiz().questions.map((q) => q.points)).size).toBeGreaterThan(4)
    // The two proofs, the derivation and the seven-part example outrank every single-result example.
    for (const single of ['q02', 'q05', 'q09', 'q10']) for (const heavy of ['q03', 'q06', 'q07', 'q12']) expect(points(single)).toBeLessThan(points(heavy))
    expect(points('q12')).toBe(Math.max(...quiz().questions.map((q) => q.points)))
    expect(points('q02')).toBe(Math.min(...quiz().questions.map((q) => q.points)))
  })

  it('adds exactly 13 questions and contexts and leaves the earlier 90-question inventory untouched', () => {
    // Families bundled after this one are pinned by their own tests; they stay out of the 103-question baseline.
    // The inventory deliberately includes the retired demo, boolean-algebra and relations fixtures (see the quiz-loader mock above),
    // so these pins keep proving the earlier families are byte-identical; the shipped inventory is pinned in quiz-loader.test.ts.
    const later = new Set(['discrete-math-ch5-relations-functions-examples', 'discrete-math-ch7-relations-second-examples',
      'discrete-math-ch8-inclusion-exclusion-examples'])
    const all = Object.values(bundledQuizSources).map((source) => parseQuiz(source, true)).filter((q) => !later.has(q.id))
    const contexts = AI_QUIZ_CONTEXT.filter((c) => !later.has(String(c.quizId)))
    expect(all).toHaveLength(9)
    expect(quizCatalog.current.filter(({ quiz: current }) => !later.has(current.id))).toHaveLength(7)
    expect(quizCatalog.errors).toEqual([])
    expect(all.flatMap((q) => q.questions)).toHaveLength(103)
    expect(contexts).toHaveLength(103)
    expect(contexts.filter((c) => String(c.quizId) === id)).toHaveLength(13)
    const old = all.filter((q) => q.id !== id).sort((a, b) => `${a.id}/${a.revision}`.localeCompare(`${b.id}/${b.revision}`))
    expect(old.map((q) => `${q.id}/${q.revision}`)).toEqual(['boolean-algebra/1', 'demo/v1-7d7c900e', 'demo/v2-handwriting',
      'discrete-math-ch1-counting-examples/1', 'discrete-math-exercises-2026/1', 'discrete-math/1', 'discrete-math/2', 'relations/1'])
    expect(sha(beforeExercisesWordingEdit(old))).toBe('b6f3d2016b2e98716c3da0ce6639058dbe9769b99d4da2984dd0cfc81e630926')
    expect(sha(beforeExercisesWordingEdit(old.map((q) => ({ id: q.id, revision: q.revision, questions: q.questions })))))
      .toBe('c3f8005c886a46135fc018783cc1a937f5e695a27ea77e1166d70b9970857df7')
    expect(sha(beforeExercisesWordingEdit(contexts.filter((c) => String(c.quizId) !== id))))
      .toBe('d3c2b4151fc216ec514a145067395cd8b048202483d3351db7441246039dd278')
    // The edit is real: without the reversal the exercises revision differs from v1.10.0.
    expect(sha(old)).not.toBe('b6f3d2016b2e98716c3da0ce6639058dbe9769b99d4da2984dd0cfc81e630926')
    // The Chapter 1 family is the template for this one and must stay byte-identical (Git may check out CRLF on Windows).
    const template = readFileSync('src/content/quizzes/discrete-math-ch1-counting-examples/v1.quiz.md', 'utf8').replace(/\r\n/g, '\n')
    expect(createHash('sha256').update(template).digest('hex')).toBe('d51cd5ce048d0b467a07992d434ce18c666c09332f5cfa03122dece7fad39665')
  })
})
