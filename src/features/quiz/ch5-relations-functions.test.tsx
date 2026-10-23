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

const id = 'discrete-math-ch5-relations-functions-examples'
const title = '離散數學第五章：關係和函數－例題練習'
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const quiz = () => {
  const value = quizCatalog.getQuizRevision(id, '1')
  expect(value, 'the Chapter 5 family must be bundled').not.toBeNull()
  return value!
}

/** Long formulas are broken over several lines; compare them without the aligned scaffolding and whitespace. */
const flat = (value: string) => value.replace(/\\begin\{aligned\}|\\end\{aligned\}|\\\\|&|\{\}|\\q?quad|\s+/g, '')
/** Subpart labels as the handout writes them: a), (a) or (1). */
const partLabel = /^(?:\([a-z]\)|[a-z]\)|\(\d\))/gm
/** The subpart label a rubric line starts with, or '' for a criterion that spans the whole question. */
const rubricLabel = (description: string) => /^(?:\([a-z]\)|\(\d\)|[a-z]\)(?:–[a-z]\))?)/.exec(description)?.[0] ?? ''

interface Example {
  id: string
  points: number
  /** Source label in the heading, before the full-width colon. */
  source: string
  /** First and last page of the 31-page handout that hold the unit. */
  pages: [number, number]
  /** Subpart labels in the prompt; a)–f) and (1)–(6) come from the handout, (a)/(b)/(c) organise q04, q08, q13 and q14. */
  parts: string[]
  /** The subpart each rubric line scores, in order ('' for the whole question). */
  rubric: string[]
  /** Statement fragments that must survive, including the definitions the prompt supplies. */
  statement: string[]
  answers: string[]
  /** Results worked out on the slide (or by the solution) that the prompt must not give away. */
  hidden: string[]
}
const ontoFormula = '\\operatorname{onto}(m,n)=\\sum_{k=0}^{n}(-1)^k\\binom{n}{n-k}(n-k)^m'
const pigeonhole = '鴿洞原理：若 $m$ 隻鴿子佔據 $n$ 個鴿洞且 $m>n$，則至少有一個鴿洞有兩隻或更多的鴿子棲息於內。'
const examples: Example[] = [
  { id: 'q01', points: 6, source: '叉積例', pages: [2, 2], parts: ['a)', 'b)', 'c)'], rubric: ['a)', 'b)', 'c)', ''],
    statement: ['依定義 5.1', 'A\\times B=\\{(a,b)\\mid a\\in A,\\ b\\in B\\}', '序對（ordered pairs）', '令 $A=\\{2,3,4\\}$，$B=\\{4,5\\}$',
      'a) 列出 $A\\times B$', 'b) 列出 $B\\times A$', 'c) 列出 $B^2=B\\times B$'],
    answers: ['A\\times B=\\{(2,4),(2,5),(3,4),(3,5),(4,4),(4,5)\\}', 'B\\times A=\\{(4,2),(4,3),(4,4),(5,2),(5,3),(5,4)\\}',
      'B^2=\\{(4,4),(4,5),(5,4),(5,5)\\}', '$(2,4)\\notin B\\times A$'],
    hidden: ['(2,5)', '(5,2)', '(5,5)', '\\ne', '\\notin'] },
  { id: 'q02', points: 6, source: '例題 5.5', pages: [3, 3], parts: ['a)', 'b)', 'c)', 'd)', 'e)', 'f)'], rubric: ['', 'a)', 'b)–e)', 'f)'],
    statement: ['依定義 5.2', '$A\\times B$ 的任一子集合被稱為一個由 $A$ 到 $B$ 的（二元）關係', '令 $A=\\{2,3,4\\}$，$B=\\{4,5\\}$',
      'a) $\\emptyset$', 'b) $\\{(2,4)\\}$', 'c) $\\{(2,4),(2,5)\\}$', 'd) $\\{(2,4),(3,4),(4,4)\\}$', 'e) $\\{(2,4),(3,4),(4,5)\\}$', 'f) $A\\times B$'],
    answers: ['A\\times B=\\{(2,4),(2,5),(3,4),(3,5),(4,4),(4,5)\\}', '都是 $A\\times B$ 的子集合', '空關係', '$0$ 個序對', 'f) $A\\times B\\subseteq A\\times B$，$6$ 個序對'],
    hidden: ['(3,5)', '\\subseteq', '空關係', '$0$ 個', '$6$ 個'] },
  { id: 'q03', points: 4, source: '關係個數例', pages: [4, 4], parts: [], rubric: ['', '', ''],
    statement: ['令 $A=\\{2,3,4\\}$，$B=\\{4,5\\}$', '求 $|A\\times B|$', '包括空關係及關係 $A\\times B$ 本身', '若 $|A|=m$ 且 $|B|=n$'],
    answers: ['$|A\\times B|=3\\cdot2=6$', '$2^6=64$ 個', '$2^{mn}$ 個'],
    hidden: ['2^6', '64', '2^{mn}', 'mn', '=6'] },
  { id: 'q04', points: 8, source: '例題 5.8', pages: [5, 5], parts: ['(a)', '(b)'], rubric: ['(a)', '(b)', '(b)', '(b)', '(b)', '(b)'],
    statement: ['\\mathscr{R}=\\{(m,n)\\mid n=7m\\}', '$\\mathbf{N}\\times\\mathbf{N}$ 的子集合', '$(0,0)$、$(1,7)$、$(11,77)$ 及 $(15,105)$',
      '- (1) $(0,0)\\in\\mathscr{R}$；且', '- (2) 若 $(s,t)\\in\\mathscr{R}$，則 $(s+1,t+7)\\in\\mathscr{R}$', '序對 $(3,21)$ 在 $\\mathscr{R}$ 上'],
    answers: ['$7\\cdot11=77$', '$7\\cdot15=105$', 'i) $(0,0)\\in\\mathscr{R}\\Rightarrow(0+1,0+7)=(1,7)\\in\\mathscr{R}$',
      'ii) $(1,7)\\in\\mathscr{R}\\Rightarrow(1+1,7+7)=(2,14)\\in\\mathscr{R}$', 'iii) $(2,14)\\in\\mathscr{R}\\Rightarrow(2+1,14+7)=(3,21)\\in\\mathscr{R}$'],
    hidden: ['(2,14)', '0+1', '7\\cdot', '\\Rightarrow'] },
  { id: 'q05', points: 8, source: '定理 5.1', pages: [6, 6], parts: ['a)', 'b)', 'c)', 'd)'], rubric: ['a)', 'b)', 'c)', 'd)'],
    statement: ['對任意集合 $A$，$B$，$C\\subseteq\\mathscr{U}$', 'a) $A\\times(B\\cap C)=(A\\times B)\\cap(A\\times C)$',
      'b) $A\\times(B\\cup C)=(A\\times B)\\cup(A\\times C)$', 'c) $(A\\cap B)\\times C=(A\\times C)\\cap(B\\times C)$',
      'd) $(A\\cup B)\\times C=(A\\times C)\\cup(B\\times C)$', '$(x,y)\\in A\\times B$ 若且唯若 $x\\in A$ 且 $y\\in B$'],
    answers: ['a) $(x,y)\\in A\\times(B\\cap C)\\Leftrightarrow x\\in A\\land y\\in B\\land y\\in C', 'b) $(x,y)\\in A\\times(B\\cup C)\\Leftrightarrow x\\in A\\land(y\\in B\\lor y\\in C)',
      'c) $(x,y)\\in(A\\cap B)\\times C\\Leftrightarrow x\\in A\\land x\\in B\\land y\\in C', 'd) $(x,y)\\in(A\\cup B)\\times C\\Leftrightarrow(x\\in A\\lor x\\in B)\\land y\\in C'],
    hidden: ['\\Leftrightarrow', '\\land', '\\lor'] },
  { id: 'q06', points: 8, source: '例題 5.9', pages: [7, 8], parts: [], rubric: ['', '', '', ''],
    statement: ['依定義 5.3', '其中 $A$ 的每個元素恰出現一次做為關係中序對的第一個分量', 'f&=\\{(1,w),(2,x),(3,x)\\}', '\\mathscr{R}_1&=\\{(1,w),(2,x)\\}',
      '\\mathscr{R}_2&=\\{(1,w),(2,w),(2,x),(3,z)\\}', '$B=\\{w,x,y,z\\}$'],
    answers: ['都是由 $A$ 到 $B$ 的關係', '$f$ 是函數', '$\\mathscr{R}_1$ 不是函數：$3$ 沒有出現為任何序對的第一個分量', '$\\mathscr{R}_2$ 不是函數：$2$ 出現兩次做為第一個分量'],
    hidden: ['沒有出現', '出現兩次', '是函數：', '不是函數：'] },
  { id: 'q07', points: 4, source: '定義 5.4 例', pages: [9, 9], parts: [], rubric: ['', '', '', ''],
    statement: ['依定義 5.4', '定義域（domain）', '對應域（codomain）', '值域（range），亦被表為 $f(A)$', '$f=\\{(1,w),(2,x),(3,x)\\}$'],
    answers: ['定義域為 $A=\\{1,2,3\\}$', '對應域為 $B=\\{w,x,y,z\\}$', '值域為 $f(A)=\\{w,x\\}$', '$f(A)\\ne B$'],
    hidden: ['\\{w,x\\}', 'f(A)=', '\\ne'] },
  { id: 'q08', points: 8, source: '一對一函數', pages: [10, 11], parts: ['(a)', '(b)'], rubric: ['(a)', '(a)', '(b)', '(b)', '(b)'],
    statement: ['依定義 5.5', '若 $B$ 的每個元素至多出現一次做為 $A$ 的某個元素之像', 'A=\\{a_1,a_2,\\ldots,a_m\\}', 'B=\\{b_1,b_2,\\ldots,b_n\\}', '$m\\le n$',
      '\\{(a_1,x_1),(a_2,x_2),\\ldots,(a_m,x_m)\\}', '乘積規則'],
    answers: ['$f(a_1)=f(a_2)\\Rightarrow a_1=a_2$', '$a_1\\ne a_2\\Rightarrow f(a_1)\\ne f(a_2)$', 'n(n-1)(n-2)\\cdots(n-m+1)=\\frac{n!}{(n-m)!}=P(n,m)=P(|B|,|A|)'],
    hidden: ['n-m+1', 'n-1', 'P(n,m)', '\\frac', '\\Rightarrow', '\\ne'] },
  { id: 'q09', points: 8, source: '例題 5.13', pages: [12, 12], parts: [], rubric: ['', '', '', '', ''],
    statement: ['$f\\colon\\mathbf{R}\\to\\mathbf{R}$', '$f(x)=3x+7$ 對所有 $x\\in\\mathbf{R}$', '$g\\colon\\mathbf{R}\\to\\mathbf{R}$', '$g(x)=x^4-x$ 對每個實數 $x$'],
    answers: ['f(x_1)=f(x_2)\\Rightarrow3x_1+7=3x_2+7\\Rightarrow3x_1=3x_2\\Rightarrow x_1=x_2', '$g(0)=0^4-0=0$', '$g(1)=1^4-1=0$', '$g(0)=g(1)$ 但 $0\\ne1$'],
    hidden: ['g(0)', 'g(1)', '3x_1', 'x_1=x_2'] },
  { id: 'q10', points: 8, source: '例題 5.21', pages: [13, 13], parts: [], rubric: ['', '', '', ''],
    statement: ['依定義 5.9', '若 $f(A)=B$，即若對所有 $b\\in B$，至少存在一個 $a\\in A$ 使得 $f(a)=b$', 'f_1&=\\{(1,z),(2,y),(3,x),(4,y)\\}',
      'f_2&=\\{(1,x),(2,x),(3,y),(4,z)\\}', 'g&=\\{(1,x),(2,x),(3,y),(4,y)\\}'],
    answers: ['$f_1(A)=\\{x,y,z\\}=B$', '$f_2(A)=\\{x,y,z\\}=B$', '$g(A)=\\{x,y\\}\\ne B$', '$g$ 不是映成'],
    hidden: ['f_1(A)', 'g(A)', '\\{x,y\\}', '不是映成'] },
  { id: 'q11', points: 10, source: '例題 5.24', pages: [14, 16], parts: [], rubric: ['', '', '', '', '', ''],
    statement: [ontoFormula, '\\sum_{k=0}^{n-1}(-1)^k\\binom{n}{n-k}(n-k)^m', '$A=\\{1,2,3,4,5,6,7\\}$，$B=\\{w,x,y,z\\}$',
      '$1\\to x$，$2\\to y$，$3\\to w$，$4\\to w$，$5\\to z$，$6\\to z$，$7\\to z$', '$7$ 個不同物體分配至 $4$ 個不同容器且無容器是空的'],
    answers: ['\\operatorname{onto}(7,4)=\\binom{4}{4}4^7-\\binom{4}{3}3^7+\\binom{4}{2}2^7-\\binom{4}{1}1^7=16384-8748+768-4=8400',
      '$(-1)^4\\binom{4}{0}0^7=0$', '$w$ 裝 $3,4$；$x$ 裝 $1$；$y$ 裝 $2$；$z$ 裝 $5,6,7$'],
    hidden: ['8400', '16384', '8748', '768', '0^7', '4^7'] },
  { id: 'q12', points: 6, source: '分配例', pages: [17, 17], parts: [], rubric: ['', '', ''],
    statement: [ontoFormula, '將 $7$ 個不同物體分配至 $4$ 個相同容器', '無容器是空的'],
    answers: ['\\frac{\\operatorname{onto}(7,4)}{4!}=\\frac{8400}{4!}=\\frac{8400}{24}=350', '對應 $4!$ 種分配至 $4$ 個不同容器的方法'],
    hidden: ['350', '8400', '4!', '24', '\\frac'] },
  { id: 'q13', points: 10, source: '例題 5.26', pages: [18, 18], parts: ['(a)', '(b)', '(c)'], rubric: ['(a)', '(a)', '(b)', '(b)', '(c)'],
    statement: [ontoFormula, '令 $A=\\{a,b,c,d\\}$，$B=\\{1,2,3\\}$', '$3$ 個不同容器且無容器是空的', '$3$ 個相同容器且無容器是空的', '(c) 列出 (b) 的所有分配'],
    answers: ['\\operatorname{onto}(4,3)=\\binom{3}{3}3^4-\\binom{3}{2}2^4+\\binom{3}{1}1^4=81-48+3=36', '\\frac{\\operatorname{onto}(4,3)}{3!}=\\frac{36}{6}=6',
      '$\\{a,b\\},\\{c\\},\\{d\\}$', '$\\{a,c\\},\\{b\\},\\{d\\}$', '$\\{a,d\\},\\{b\\},\\{c\\}$', '$\\{b,c\\},\\{a\\},\\{d\\}$', '$\\{b,d\\},\\{a\\},\\{c\\}$', '$\\{c,d\\},\\{a\\},\\{b\\}$'],
    hidden: ['36', '81', '48', '3!', '\\{a,b\\}', '\\{c,d\\}'] },
  { id: 'q14', points: 8, source: '第二型 Stirling 數', pages: [19, 19], parts: ['(a)', '(b)'], rubric: ['(a)', '(a)', '(a)', '(b)', '(b)'],
    statement: [ontoFormula, '對 $m\\ge n$', '有編號（否則為相同）的容器', '被表為 $S(m,n)$', '第二型的 Stirling 數（Stirling number of the second kind）', '$|A|=m\\ge n=|B|$'],
    answers: ['S(m,n)=\\frac{1}{n!}\\sum_{k=0}^{n}(-1)^k\\binom{n}{n-k}(n-k)^m=\\frac{1}{n!}\\cdot\\operatorname{onto}(m,n)', '$n!\\cdot S(m,n)$ 個'],
    hidden: ['n!', '\\frac{1}', '350', '\\cdotS'] },
  { id: 'q15', points: 4, source: '例題 5.39', pages: [22, 23], parts: [], rubric: ['', '', ''],
    statement: [pigeonhole, '某辦公室雇用 $13$ 位檔案文書', '生日在同一個月份'],
    answers: ['鴿子是 $13$ 位檔案文書', '鴿洞是一年的 $12$ 個月份', '$13>12$'],
    hidden: ['12', '十二月'] },
  { id: 'q16', points: 6, source: '例題 5.42', pages: [24, 24], parts: [], rubric: ['', '', ''],
    statement: [pigeonhole, '除法演算法（定理 4.5）', 'n=36q+r,\\qquad 0\\le r<36', '令 $S\\subset\\mathbf{Z}^+$，其中 $|S|=37$', '被 $36$ 除有相同餘數'],
    answers: ['鴿子是 $S$ 中的 $37$ 個正整數', '鴿洞是 $36$ 個可能的餘數 $0,1,\\ldots,35$', '$37>36$'],
    hidden: ['35', '37>36', '36 個'] },
  { id: 'q17', points: 8, source: '例題 5.44', pages: [25, 25], parts: [], rubric: ['', '', '', ''],
    statement: [pigeonhole, '$S=\\{1,2,3,\\ldots,9\\}$', '大小為 $6$ 的子集合', '其和為 $10$', '$\\{2,3,5,6,8,9\\}$'],
    answers: ['$\\{1,9\\}$、$\\{2,8\\}$、$\\{3,7\\}$、$\\{4,6\\}$、$\\{5\\}$', '$6>5$', '$\\{5\\}$ 只有一個元素', '$2+8=10$'],
    hidden: ['\\{1,9\\}', '\\{2,8\\}', '\\{4,6\\}', '\\{5\\}', '2+8', '6>5'] },
  { id: 'q18', points: 10, source: '例題 5.46', pages: [26, 27], parts: [], rubric: ['', '', '', '', '', ''],
    statement: [pigeonhole, '令 $S$ 為六個正整數的集合，其中極大值最多是 $14$', '所有非空子集合內的元素和不可能均相異', '以 $s_A$ 表示 $A$ 中的元素和',
      '$S=\\{5,10,11,12,13,14\\}$'],
    answers: ['$1\\le s_A\\le9+10+\\cdots+14=69$', '$2^6-1=63$', '$1\\le s_A\\le10+11+\\cdots+14=60$', '$2^6-2=62$', '$62>60$', '$\\{10,13\\}$ 與 $\\{11,12\\}$ 的和都是 $23$'],
    hidden: ['69', '60', '62', '63', '23', '\\{10,13\\}', '|A|\\le5'] },
  { id: 'q19', points: 8, source: '鴿洞原理例', pages: [28, 28], parts: [], rubric: ['', '', '', ''],
    statement: [pigeonhole, '若由 $S=\\{1,2,3,\\ldots,200\\}$ 選出 $101$ 個整數', '$\\gcd(m,n)=1$', '$1,3,5,\\ldots,199$ 這 $100$ 個奇數再加上 $100$'],
    answers: ['鴿洞為 $\\{2i-1,2i\\}$，$i=1,2,\\ldots,100$', '$101>100$', '$(n+1)-n=1$', '$\\gcd(n,n+1)=1$', '$99$ 與 $100$ 同在 $\\{99,100\\}$，$\\gcd(99,100)=1$'],
    hidden: ['2i-1', '\\{99,100\\}', '\\{199,200\\}', 'n+1', '101>100'] },
  { id: 'q20', points: 12, source: '表 5.13', pages: [29, 30], parts: ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)'], rubric: ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)'],
    statement: ['講義表 5.13', ontoFormula, '第二型 Stirling 數 $S(m,n)$', '把 $m=4$ 個物體分配至 $n=3$ 個容器',
      '(1) 物體相異，容器相異，有些容器可能是空的。', '(2) 物體相異，容器相異，沒有容器是空的。', '(3) 物體相異，容器相同，有些容器可能是空的。',
      '(4) 物體相異，容器相同，沒有容器是空的。', '(5) 物體相同，容器相異，有些容器可能是空的。', '(6) 物體相同，容器相異，沒有容器是空的。'],
    answers: ['(1) $n^m=3^4=81$', '(2) $\\operatorname{onto}(m,n)=n!\\,S(m,n)$；$\\operatorname{onto}(4,3)=81-48+3=36$',
      '(3) $S(m,1)+S(m,2)+\\cdots+S(m,n)$；$S(4,1)+S(4,2)+S(4,3)=1+7+6=14$', '(4) $S(m,n)$；$S(4,3)=6$',
      '(5) $\\binom{n+m-1}{m}$；$\\binom{6}{4}=15$', '(6) $\\binom{m-1}{n-1}$；$\\binom{3}{2}=3$'],
    hidden: ['n^m', '3^4', '81', '36', '14', '15', 'n!', '\\binom{6}{4}', '\\binom{n+m-1}{m}', '\\binom{m-1}{n-1}', 'S(m,1)+'] },
]
/** Every page that is not part of a question, with the reason it is left out. */
const excludedPages: Record<number, string> = {
  1: 'chapter title',
  20: 'marked (略): identical containers with empty containers allowed; left out by human decision',
  21: 'marked (略): Example 5.27 and Table 5.1; left out by human decision',
  31: 'closing page',
}
const question = (questionId: string) => {
  const found = quiz().questions.find((candidate) => candidate.id === questionId)
  if (found?.type !== 'calculation') throw new Error(`${questionId} must be a calculation question`)
  return found
}
const pageRange = ([first, last]: [number, number]) => (first === last ? `${first}` : `${first}–${last}`)
const pagesOf = ([first, last]: [number, number]) => Array.from({ length: last - first + 1 }, (_, index) => first + index)

afterEach(cleanup)

describe('PDF-backed Chapter 5 relations and functions practice', () => {
  it('bundles revision 1 (archived by revision 2) with 20 handwriting-capable calculations worth 150 points', () => {
    const value = quiz()
    expect(value).toMatchObject({ id, revision: '1', current: false, title, subject: '離散數學', estimatedMinutes: 120 })
    expect(value.tags).toEqual(['cartesian-product', 'relations', 'functions', 'one-to-one', 'onto', 'stirling-numbers', 'pigeonhole-principle'])
    expect(value.questions.map((q) => q.id)).toEqual(examples.map((example) => example.id))
    expect(new Set(value.questions.map((q) => q.id)).size).toBe(20)
    expect(value.questions.map((q) => q.points)).toEqual(examples.map((example) => example.points))
    expect(value.questions.reduce((sum, q) => sum + q.points, 0)).toBe(150)
    expect(value.questions.every((q) => q.type === 'calculation' && q.drawing?.width === 1200 && q.drawing.height === 900)).toBe(true)
    expect(value.questions.every((q) => q.tags.length > 0 && q.tags.every((tag) => value.tags.includes(tag)))).toBe(true)
    expect(new Set(value.questions.flatMap((q) => q.tags))).toEqual(new Set(value.tags))
    expect(requiresV4Draft(value)).toBe(true)
    expect(publicationErrors(value)).toEqual([])
    expect(inspectQuiz(value)).toMatchObject({ questionCount: 20, totalDeclaredPoints: 150, deterministicMax: 0,
      calculationDrawingPoints: 150, questionTypes: { single: 0, multiple: 0, 'true-false': 0, fill: 0, calculation: 20, drawing: 0 } })
    // Revision 2 (v1.16.1) removed two questions and is the current one; revision 1 stays bundled for its drafts and history.
    expect(quizCatalog.getCurrentQuiz(id)?.revision).toBe('2')
    expect(quizCatalog.getQuizRevision(id, '3')).toBeNull()
  })

  it.each(examples)('$id keeps the source statement, subparts and an answer-free prompt', (example) => {
    const q = question(example.id)
    const heading = q.prompt.split('\n')[0]
    expect(heading.startsWith(`### ${example.source}：`)).toBe(true)
    expect(heading.endsWith(`（講義第 ${pageRange(example.pages)} 頁）`)).toBe(true)
    for (const fragment of example.statement) expect(flat(q.prompt), fragment).toContain(flat(fragment))
    expect(q.prompt.match(partLabel) ?? []).toEqual(example.parts)
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
    expect(q.rubric.map((r) => rubricLabel(r.description))).toEqual(example.rubric)
    for (const part of example.parts) {
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
    const context = AI_QUIZ_CONTEXT.find((c) => String(c.quizId) === id && String(c.revision) === '1' && String(c.questionId) === example.id)
    expect(context).toEqual(toTutorContext(value, q))
  })

  it('renders every formula with KaTeX and keeps the source free of Markdown tables and HTML', () => {
    const source = Object.values(bundledQuizSources).find((candidate) => candidate.includes(`id="${id}" revision="1"`))!
    const formulas = [...source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)].map((match) => match[0])
    expect(formulas.length).toBeGreaterThan(500)
    // One paragraph per formula: every one must become exactly one KaTeX node and none may fail to parse.
    const { container } = render(<Markdown>{formulas.join('\n\n')}</Markdown>)
    expect([...container.querySelectorAll('.katex-error')].map((error) => error.textContent)).toEqual([])
    expect(container.querySelectorAll('.katex')).toHaveLength(formulas.length)
    expect(source).not.toMatch(/^\s*\|.*\|\s*$/m)
    expect(source).not.toMatch(/<\/?[a-zA-Z][^>]*>/)
    // Tables are KaTeX arrays: the two the solutions use, nothing else.
    expect(source.match(/\\begin\{array\}/g)).toHaveLength(2)
  })

  it('maps every page of the 31-page handout: 20 units in source order, none omitted, none invented', () => {
    const included = examples.flatMap((example) => pagesOf(example.pages))
    expect(included).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 27, 28, 29, 30])
    expect(new Set(included).size).toBe(included.length)
    const excluded = Object.keys(excludedPages).map(Number)
    expect(excluded.filter((page) => included.includes(page))).toEqual([])
    expect([...included, ...excluded].sort((a, b) => a - b)).toEqual(Array.from({ length: 31 }, (_, index) => index + 1))
    const headings = quiz().questions.map((q) => q.prompt.split('\n')[0])
    expect(headings).toHaveLength(examples.length)
    expect(headings.map((heading) => heading.replace(/^### /, '').replace(/：.*$/, ''))).toEqual(examples.map((example) => example.source))
    expect(headings.map((heading) => /（講義第 ([\d–]+) 頁）$/.exec(heading)?.[1])).toEqual(examples.map((example) => pageRange(example.pages)))
    const source = Object.values(bundledQuizSources).find((candidate) => candidate.includes(`id="${id}" revision="1"`))!
    for (const directive of ['question', 'drawing', 'answer', 'solution', 'rubric', 'end']) {
      expect(source.match(new RegExp(`^:::${directive}\\b`, 'gm'))).toHaveLength(20)
    }
    expect(source).not.toMatch(/^:::hint\b/m)
    expect(source.match(/^width=1200\r?\nheight=900\r?$/gm)).toHaveLength(20)
  })

  it('marks what the solutions add beyond the handout', () => {
    expect(question('q02').solution).toContain('講義只列出這六個關係，沒有寫出理由；以上判斷是依定義 5.2 推得。')
    expect(question('q05').solution.startsWith('講義只有定理敘述，證明依定義 5.1 推得。')).toBe(true)
    expect(question('q06').solution).toContain('講義只問「為什麼？」，沒有寫出理由；以上理由依定義 5.3 推得。')
    expect(question('q08').solution).toContain('（依定義 5.5 推得）')
    expect(question('q17').solution).toContain('講義的例子沒有寫出哪兩個數的和為 $10$')
    expect(question('q18').solution).toContain('講義的例子沒有指出哪兩個子集合同和')
    expect(question('q19').solution).toContain('下面的完整推論是依鴿洞原理與最大公因數的定義補上的。')
    expect(question('q20').solution).toContain('(5)(6) 的 $15$、$3$ 是題庫代入 $m=4$、$n=3$ 算出的，講義沒有這兩個數值。')
    expect(question('q20').solution).toContain('例題 5.26（$36$ 與 $6$）及講義第 21 頁的 Example 5.27（$14$）')
    // Source typos from appendix C are written correctly.
    const all = examples.map(({ id: questionId }) => question(questionId)).map((q) => [q.prompt, q.referenceAnswer, q.solution].join('\n')).join('\n')
    for (const typo of ['有為限', '必為有', '的的', '共有 $2^6$ 由', 'x_2+\\ldots x_n']) expect(all).not.toContain(typo)
  })

  it('recomputes the answers instead of trusting the slide', () => {
    const answer = (questionId: string) => flat(question(questionId).referenceAnswer)
    const tex = (pairs: (string | number)[][]) => `\\{${pairs.map((pair) => `(${pair.join(',')})`).join(',')}\\}`
    const cross = <S, T>(left: S[], right: T[]) => left.flatMap((s) => right.map((t) => [s, t] as [S, T]))
    const [A, B] = [[2, 3, 4], [4, 5]]

    // q01-q03: cross products and the number of relations.
    expect(answer('q01')).toContain(flat(`A\\times B=${tex(cross(A, B))}`))
    expect(answer('q01')).toContain(flat(`B\\times A=${tex(cross(B, A))}`))
    expect(answer('q01')).toContain(flat(`B^2=${tex(cross(B, B))}`))
    expect(answer('q02')).toContain(flat(`A\\times B=${tex(cross(A, B))}`))
    const key = (pair: number[]) => pair.join()
    const product = new Set(cross(A, B).map(key))
    const relations = [[], [[2, 4]], [[2, 4], [2, 5]], [[2, 4], [3, 4], [4, 4]], [[2, 4], [3, 4], [4, 5]], cross(A, B)]
    expect(relations.every((relation) => relation.every((pair) => product.has(key(pair))))).toBe(true)
    expect(relations.map((relation) => relation.length)).toEqual([0, 1, 2, 3, 3, 6])
    const pairs = [...product]
    const subsets = new Set(Array.from({ length: 2 ** pairs.length }, (_, mask) => pairs.filter((_, i) => mask & (1 << i)).join(';')))
    expect(subsets.size).toBe(64)
    expect(answer('q03')).toContain(`2^${pairs.length}=${subsets.size}`)

    // q04: the recursive chain reaches (3,21) and agrees with n = 7m.
    const chain = [[0, 0]]
    while (chain.length < 4) chain.push([chain.at(-1)![0] + 1, chain.at(-1)![1] + 7])
    expect(chain).toEqual([[0, 0], [1, 7], [2, 14], [3, 21]])
    expect([[0, 0], [1, 7], [11, 77], [15, 105], [3, 21]].every(([m, n]) => n === 7 * m)).toBe(true)

    // q05: Theorem 5.1 for every choice of A, B, C inside a three-element universe (sets as bit masks).
    const members = (mask: number) => [0, 1, 2].filter((bit) => mask & (1 << bit))
    const times = (s: number, t: number) => new Set(cross(members(s), members(t)).map(key))
    const same = (x: Set<string>, y: Set<string>) => x.size === y.size && [...x].every((item) => y.has(item))
    const meet = (x: Set<string>, y: Set<string>) => new Set([...x].filter((item) => y.has(item)))
    const join = (x: Set<string>, y: Set<string>) => new Set([...x, ...y])
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) for (let c = 0; c < 8; c++) {
      expect(same(times(a, b & c), meet(times(a, b), times(a, c)))).toBe(true)
      expect(same(times(a, b | c), join(times(a, b), times(a, c)))).toBe(true)
      expect(same(times(a & b, c), meet(times(a, c), times(b, c)))).toBe(true)
      expect(same(times(a | b, c), join(times(a, c), times(b, c)))).toBe(true)
    }

    // q06, q07, q10: functions, ranges and onto.
    const firsts = (relation: [number, string][]) => [1, 2, 3].map((x) => relation.filter(([a]) => a === x).length)
    expect(firsts([[1, 'w'], [2, 'x'], [3, 'x']])).toEqual([1, 1, 1])
    expect(firsts([[1, 'w'], [2, 'x']])).toEqual([1, 1, 0])
    expect(firsts([[1, 'w'], [2, 'w'], [2, 'x'], [3, 'z']])).toEqual([1, 2, 1])
    expect(new Set(['w', 'x', 'x'])).toEqual(new Set(['w', 'x']))
    const range = (images: string[]) => [...new Set(images)].sort().join()
    expect([range(['z', 'y', 'x', 'y']), range(['x', 'x', 'y', 'z']), range(['x', 'x', 'y', 'y'])]).toEqual(['x,y,z', 'x,y,z', 'x,y'])

    // q08: one-to-one functions by enumeration, for every m <= n <= 5.
    const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))
    const functions = (m: number, n: number) => Array.from({ length: n ** m }, (_, code) => Array.from({ length: m }, (_, i) => Math.floor(code / n ** i) % n))
    for (let n = 1; n <= 5; n++) for (let m = 0; m <= n; m++) {
      expect(functions(m, n).filter((images) => new Set(images).size === m)).toHaveLength(factorial(n) / factorial(n - m))
    }

    // q09: f(x) = 3x + 7 is injective on a sample, g(0) = g(1).
    expect(new Set(Array.from({ length: 101 }, (_, i) => 3 * (i - 50) + 7)).size).toBe(101)
    expect([0 ** 4 - 0, 1 ** 4 - 1]).toEqual([0, 0])

    // q11-q14, q20: onto by brute force against the formula, and Stirling numbers.
    const binom = (n: number, k: number): number => (k < 0 || k > n ? 0 : k === 0 ? 1 : (binom(n, k - 1) * (n - k + 1)) / k)
    const onto = (m: number, n: number) => functions(m, n).filter((images) => new Set(images).size === n).length
    const formula = (m: number, n: number, upper = n) =>
      Array.from({ length: upper + 1 }, (_, k) => (-1) ** k * binom(n, n - k) * (n - k) ** m).reduce((sum, term) => sum + term, 0)
    expect([binom(4, 4) * 4 ** 7, binom(4, 3) * 3 ** 7, binom(4, 2) * 2 ** 7, binom(4, 1) * 1 ** 7]).toEqual([16384, 8748, 768, 4])
    expect([onto(7, 4), formula(7, 4), formula(7, 4, 3)]).toEqual([8400, 8400, 8400])
    expect(answer('q11')).toContain('=16384-8748+768-4=8400')
    expect(onto(7, 4) / factorial(4)).toBe(350)
    expect(answer('q12')).toContain('=\\frac{8400}{24}=350')
    expect([binom(3, 3) * 3 ** 4, binom(3, 2) * 2 ** 4, binom(3, 1) * 1 ** 4]).toEqual([81, 48, 3])
    expect([onto(4, 3), onto(4, 3) / factorial(3)]).toEqual([36, 6])
    expect(answer('q13')).toContain('=81-48+3=36')
    // Set partitions of {a,b,c,d} into three blocks: exactly the six the answer lists.
    const partitions = (items: string[]): string[][][] => {
      if (items.length === 0) return [[]]
      const [first, ...rest] = items
      return partitions(rest).flatMap((blocks) => [[[first], ...blocks], ...blocks.map((_, i) => blocks.map((block, j) => (i === j ? [first, ...block] : block)))])
    }
    const threeBlocks = partitions(['a', 'b', 'c', 'd']).filter((blocks) => blocks.length === 3)
    expect(threeBlocks).toHaveLength(6)
    for (const blocks of threeBlocks) {
      const ordered = [...blocks].sort((x, y) => y.length - x.length || x.join().localeCompare(y.join()))
      expect(question('q13').referenceAnswer).toContain(`$${ordered.map((block) => `\\{${block.sort().join(',')}\\}`).join(',')}$`)
    }
    const stirling = (m: number, n: number) => partitions(Array.from({ length: m }, (_, i) => String(i))).filter((blocks) => blocks.length === n).length
    for (let m = 1; m <= 6; m++) for (let n = 1; n <= m; n++) {
      expect(onto(m, n)).toBe(factorial(n) * stirling(m, n))
      expect(formula(m, n) / factorial(n)).toBe(stirling(m, n))
    }
    expect(stirling(7, 4)).toBe(350)
    // q20: Table 5.13 with m = 4, n = 3, every row by brute force.
    const [m, n] = [4, 3]
    const compositions = (lowest: number) => functions(n, m + 1).filter((xs) => xs.every((x) => x >= lowest) && xs.reduce((s, x) => s + x, 0) === m).length
    const rows = [n ** m, onto(m, n), [1, 2, 3].reduce((sum, i) => sum + stirling(m, i), 0), stirling(m, n), compositions(0), compositions(1)]
    expect(rows).toEqual([81, 36, 14, 6, 15, 3])
    expect([binom(n + m - 1, m), binom(m - 1, n - 1), binom(n + (m - n) - 1, m - n), binom(m - 1, m - n)]).toEqual([15, 3, 3, 3])
    expect([1, 2, 3].map((i) => stirling(4, i))).toEqual([1, 7, 6])
    expect(answer('q20')).toContain('=1+7+6=14')
  })

  it('recomputes the pigeonhole examples by exhaustive search', () => {
    const answer = (questionId: string) => flat(question(questionId).referenceAnswer)
    const combinations = <T,>(items: T[], size: number): T[][] => (size === 0 ? [[]] : items.flatMap((item, i) =>
      combinations(items.slice(i + 1), size - 1).map((rest) => [item, ...rest])))
    // q15, q16: the number of holes (months, remainders) is one less than the number of pigeons.
    const months = new Set(Array.from({ length: 366 }, (_, day) => new Date(Date.UTC(2024, 0, day + 1)).getUTCMonth()))
    expect(answer('q15')).toContain(`${months.size + 1}>${months.size}`)
    const remainders = new Set(Array.from({ length: 1000 }, (_, i) => (i + 1) % 36))
    expect(remainders.size).toBe(36)
    expect(answer('q16')).toContain(`${remainders.size + 1}>${remainders.size}`)
    // q17: the five holes partition 1..9, every 6-subset has a pair summing to 10, and the example has only 2 + 8.
    const holes = [[1, 9], [2, 8], [3, 7], [4, 6], [5]]
    expect(holes.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const six = combinations([1, 2, 3, 4, 5, 6, 7, 8, 9], 6)
    expect(six).toHaveLength(84)
    expect(six.every((subset) => combinations(subset, 2).some(([a, b]) => a + b === 10))).toBe(true)
    expect(combinations([2, 3, 5, 6, 8, 9], 2).filter(([a, b]) => a + b === 10)).toEqual([[2, 8]])
    // q18: the bounds, the example, and the claim itself for every admissible S.
    const sum = (items: number[]) => items.reduce((total, item) => total + item, 0)
    expect([sum([9, 10, 11, 12, 13, 14]), sum([10, 11, 12, 13, 14]), 2 ** 6 - 1, 2 ** 6 - 2]).toEqual([69, 60, 63, 62])
    expect(sum([10, 13])).toBe(23)
    expect(sum([11, 12])).toBe(23)
    const repeats = (set: number[]) => {
      const sums = Array.from({ length: 63 }, (_, mask) => sum(set.filter((_, i) => (mask + 1) & (1 << i))))
      return new Set(sums).size < sums.length
    }
    expect(combinations(Array.from({ length: 14 }, (_, i) => i + 1), 6).every(repeats)).toBe(true)
    expect(answer('q18')).toContain('=69')
    expect(answer('q18')).toContain('=60')
    // q19: one hundred holes {2i-1, 2i}, consecutive integers are coprime, and the example shares only {99, 100}.
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
    const pairs = Array.from({ length: 100 }, (_, i) => [2 * i + 1, 2 * i + 2])
    expect(pairs.flat()).toEqual(Array.from({ length: 200 }, (_, i) => i + 1))
    expect(Array.from({ length: 199 }, (_, i) => gcd(i + 1, i + 2)).every((d) => d === 1)).toBe(true)
    const chosen = new Set([...Array.from({ length: 100 }, (_, i) => 2 * i + 1), 100])
    expect(chosen.size).toBe(101)
    expect(pairs.filter(([odd, even]) => chosen.has(odd) && chosen.has(even))).toEqual([[99, 100]])
    expect(gcd(99, 100)).toBe(1)
  })

  it('scales points with the amount of work instead of giving every example the same score', () => {
    const points = (questionId: string) => question(questionId).points
    expect(new Set(quiz().questions.map((q) => q.points)).size).toBeGreaterThan(4)
    // The table, the formula-heavy examples and the two-stage pigeonhole proof outrank every single-result example.
    for (const single of ['q03', 'q07', 'q15']) for (const heavy of ['q11', 'q13', 'q18', 'q20']) expect(points(single)).toBeLessThan(points(heavy))
    expect(points('q20')).toBe(Math.max(...quiz().questions.map((q) => q.points)))
    for (const single of ['q03', 'q07', 'q15']) expect(points(single)).toBe(Math.min(...quiz().questions.map((q) => q.points)))
  })

  it('adds exactly 20 questions and contexts and leaves the earlier 103-question inventory untouched', () => {
    // The inventory deliberately includes the retired demo, boolean-algebra and relations fixtures (see the quiz-loader mock above),
    // so these pins keep proving the earlier families are byte-identical; the shipped inventory is pinned in quiz-loader.test.ts.
    const chapter7 = 'discrete-math-ch7-relations-second-examples'
    const chapter8 = 'discrete-math-ch8-inclusion-exclusion-examples'
    const later = new Set([chapter8, 'discrete-math-midterm-2021', 'discrete-math-midterm-2023', 'discrete-math-midterm-2024',
      'economics-ch1-4-exercises', 'digital-systems-ch1-textbook', 'digital-systems-ch2-textbook', 'digital-systems-ch3-textbook'])
    const all = Object.values(bundledQuizSources).map((source) => parseQuiz(source, true)).filter((q) => !later.has(q.id))
    const contexts = AI_QUIZ_CONTEXT.filter((c) => !later.has(String(c.quizId)))
    // Later Chapter 8, midterm, economics and digital-systems families stay outside this inventory; Chapter 7 is excluded from older hashes below.
    expect(all).toHaveLength(12)
    expect(quizCatalog.current.filter(({ quiz }) => !later.has(quiz.id))).toHaveLength(9)
    expect(quizCatalog.errors).toEqual([])
    expect(all.flatMap((q) => q.questions)).toHaveLength(162)
    expect(contexts).toHaveLength(162)
    expect(contexts.filter((c) => String(c.quizId) === id && String(c.revision) === '1')).toHaveLength(20)
    expect(contexts.filter((c) => String(c.quizId) === id && String(c.revision) === '2')).toHaveLength(18)
    const old = all.filter((q) => q.id !== id && q.id !== chapter7)
      .sort((a, b) => (a.id + '/' + a.revision).localeCompare(b.id + '/' + b.revision))
    expect(old.map((q) => `${q.id}/${q.revision}`)).toEqual(['boolean-algebra/1', 'demo/v1-7d7c900e', 'demo/v2-handwriting',
      'discrete-math-ch1-counting-examples/1', 'discrete-math-ch3-set-theory-examples/1', 'discrete-math-exercises-2026/1', 'discrete-math/1',
      'discrete-math/2', 'relations/1'])
    expect(sha(old)).toBe('dd07341108a87c86da3cf894d4eb02348f55861707ac9f04e55607023567fa69')
    expect(sha(old.map((q) => ({ id: q.id, revision: q.revision, questions: q.questions })))).toBe('11ce5ff42cfa01963b0303fb9448afdce7bd280d8197a53d91ad2c39493d2639')
    expect(sha(contexts.filter((c) => String(c.quizId) !== id && String(c.quizId) !== chapter7)))
      .toBe('1153e47529798807e27378aae4b1680d6f1b1a2daf1544ecd20de5a6f0d2e09c')
    // The Chapter 3 family is the template for this one and must stay byte-identical (Git may check out CRLF on Windows).
    const template = readFileSync('src/content/quizzes/discrete-math-ch3-set-theory-examples/v1.quiz.md', 'utf8').replace(/\r\n/g, '\n')
    expect(createHash('sha256').update(template).digest('hex')).toBe('171d687a5d535a734cc9d1acea4f7b1d8a8fb94deb8da586dd0007d4cce90195')
  })
})
