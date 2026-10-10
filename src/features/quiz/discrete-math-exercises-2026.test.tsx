// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Markdown } from '../../components/Markdown'
import { parseQuiz } from '../../lib/quiz-parser'
import { requiresV4Draft } from '../../lib/draft-v4'
import { inspectQuiz, publicationErrors } from '../author/authoring-core'
import { toTutorContext } from '../../../scripts/ai-quiz-context'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { bundledQuizSources, quizCatalog } from './quiz-loader'

const id = 'discrete-math-exercises-2026'
const title = '離散數學習題 Ch1、Ch3、Ch5、Ch7、Ch8'
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const quiz = () => {
  const value = quizCatalog.getQuizRevision(id, '1')
  expect(value, 'the 2026 exercises family must be bundled').not.toBeNull()
  return value!
}

interface Exercise {
  id: string
  points: number
  /** Source heading: handout section and exercise number. */
  source: string
  /** Subpart labels the handout shows, and labels it deliberately omits. */
  parts: string[]
  omitted?: string[]
  /** Statement fragments that must survive verbatim, including every inequality. */
  statement: string[]
  answers: string[]
}
const exercises: Exercise[] = [
  { id: 'q01', points: 8, source: 'Exercises 1.1 and 1.2 第 21 題', parts: ['(a)', '(b)'], omitted: ['(c)'],
    statement: ['all the letters in SOCIOLOGICAL', 'are A and G adjacent'],
    answers: ['\\dfrac{12!}{3!\\,2!\\,2!\\,2!}=9{,}979{,}200', '1{,}663{,}200'] },
  { id: 'q02', points: 8, source: 'Exercises 1.3 第 12 題', parts: ['(a)', '(b)'],
    statement: ['12 different books be distributed among four children', 'each child gets three books',
      'the two oldest children get four books each and the two youngest get two books each'],
    answers: ['\\dfrac{12!}{(3!)^4}=369{,}600', '\\dfrac{12!}{(4!)^2(2!)^2}=207{,}900'] },
  { id: 'q03', points: 6, source: 'Exercises 1.3 第 13 題', parts: [],
    statement: ['arrangements of the letters in MISSISSIPPI', "no consecutive S's"],
    answers: ['\\dbinom{8}{4}\\cdot\\dfrac{7!}{4!\\,2!}', '=7350'] },
  { id: 'q04', points: 20, source: 'Exercises 1.4 第 7 題', parts: ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'],
    statement: ['x_1+x_2+x_3+x_4=32', '$x_i \\ge 0,\\quad 1 \\le i \\le 4$', '$x_i > 0,\\quad 1 \\le i \\le 4$',
      '$x_1, x_2 \\ge 5,\\quad x_3, x_4 \\ge 7$', '$x_i \\ge 8,\\quad 1 \\le i \\le 4$', '$x_i \\ge -2,\\quad 1 \\le i \\le 4$',
      '$x_1, x_2, x_3 > 0,\\quad 0 < x_4 \\le 25$'],
    answers: ['\\dbinom{35}{32}=6545', '\\dbinom{31}{28}=4495', '\\dbinom{11}{8}=165', '(d) $1$', '\\dbinom{43}{40}=12{,}341',
      '\\dbinom{31}{28}-\\dbinom{6}{3}=4495-20=4475'] },
  { id: 'q05', points: 10, source: 'Exercises 3.1 第 12 題', parts: ['(a)', '(b)', '(c)'],
    statement: ['$A=\\{1, 2, 3, 4, 5, 7, 8, 10, 11, 14, 17, 18\\}$', 'subsets of $A$ contain six elements',
      'six-element subsets of $A$ contain four even integers and two odd integers', 'subsets of $A$ contain only odd integers'],
    answers: ['\\dbinom{12}{6}=924', '\\dbinom{6}{4}\\dbinom{6}{2}=225', '2^6-1=63'] },
  { id: 'q06', points: 12, source: 'Exercises 3.3 第 7 題', parts: ['(a)', '(b)'],
    statement: ['permutations of the 26 different letters of the alphabet', 'either the pattern "OUT" or the pattern "DIG"',
      'neither the pattern "MAN" nor the pattern "ANT"'],
    answers: ['2(24!)-22!', '26!-[2(24!)-23!]=26!-2(24!)+23!'] },
  { id: 'q07', points: 16, source: 'Exercises 5.1 第 3 題', parts: ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'],
    statement: ['$A=\\{1, 2, 3\\}$, and $B=\\{2, 4, 5\\}$', '$|A \\times B|$', 'the number of relations from $A$ to $B$',
      'the number of relations on $A$', 'contain $(1, 2)$ and $(1, 5)$', 'contain exactly five ordered pairs',
      'relations on $A$ that contain at least seven elements'],
    answers: ['|A\\times B|=9', '(b) $2^9=512$', '(c) $2^9=512$', '2^7=128', '\\dbinom{9}{5}=126',
      '\\dbinom{9}{7}+\\dbinom{9}{8}+\\dbinom{9}{9}=46'] },
  { id: 'q08', points: 10, source: 'Exercises 5.2 第 22 題', parts: ['(a)', '(b)'],
    statement: ['$X_n=\\{1, 2, 3, \\ldots, n\\}$', '*monotone increasing*', '$1 \\le i < j \\le m \\Rightarrow f(i) \\le f(j)$',
      'domain $X_7$ and codomain $X_5$', 'domain $X_6$ and codomain $X_9$'],
    answers: ['\\dbinom{11}{7}=330', '\\dbinom{14}{6}=3003'] },
  { id: 'q09', points: 15, source: 'Exercises 5.3 第 10 題', parts: ['(a)', '(b)', '(c)'],
    statement: ['seven different colored balls and four containers numbered I, II, III, and IV', 'no container is left empty',
      'no container is empty and the blue ball is in container II', 'among the four identical containers, with some container(s) possibly empty'],
    answers: ['4!\\,S(7,4)=8400', '3!\\,S(6,3)+4!\\,S(6,4)=540+1560=2100', 'S(7,4)+S(7,3)+S(7,2)+S(7,1)=715'] },
  { id: 'q10', points: 16, source: 'Exercises 7.1 第 5 題', parts: ['(a)', '(c)', '(e)', '(f)'], omitted: ['(b)', '(d)'],
    statement: ['determine whether the relation is reflexive, symmetric, antisymmetric, or transitive',
      '$\\mathscr{R} \\subseteq \\mathbf{Z}^+ \\times \\mathbf{Z}^+$ where $a\\,\\mathscr{R}\\,b$ if $a \\mid b$',
      'a fixed subset $C$ of $\\mathscr{U}$', '$\\mathcal{P}(\\mathscr{U})$', '$A \\cap C = B \\cap C$',
      'relation on $\\mathbf{Z}$ where $x\\,\\mathscr{R}\\,y$ if $x+y$ is odd', 'relation on $\\mathbf{Z}$ where $x\\,\\mathscr{R}\\,y$ if $x-y$ is even'],
    answers: ['(a) reflexive、antisymmetric、transitive', '(c) reflexive、symmetric、transitive', '(e) 只有 symmetric',
      '(f) reflexive、symmetric、transitive'] },
  { id: 'q11', points: 8, source: 'Exercises 7.4 第 4 題', parts: ['(a)', '(b)'],
    statement: ['$A=\\{1, 2, 3, 4, 5, 6\\}$', '\\mathscr{R}=\\{&(1, 1), (1, 2), (2, 1), (2, 2),\\\\', '&(3, 3), (4, 4), (4, 5),\\\\',
      '&(5, 4), (5, 5), (6, 6)\\}', 'is an equivalence relation on $A$', 'What are $[1]$, $[2]$, and $[3]$',
      'What partition of $A$ does $\\mathscr{R}$ induce'],
    answers: ['[1]=\\{1,2\\}=[2]', '[3]=\\{3\\}', 'A=\\{1,2\\}\\cup\\{3\\}\\cup\\{4,5\\}\\cup\\{6\\}'] },
  { id: 'q12', points: 12, source: 'Exercises 8.1 第 6 題', parts: ['(a)', '(b)'],
    statement: ['$x_1+x_2+x_3+x_4=19$', '$0 \\le x_i$ for all $1 \\le i \\le 4$', '$0 \\le x_i < 8$ for all $1 \\le i \\le 4$'],
    answers: ['\\dbinom{22}{19}=1540', '\\dbinom{22}{19}-4\\dbinom{14}{11}+6\\dbinom{6}{3}=1540-1456+120=204'] },
  { id: 'q13', points: 9, source: 'Chapter 8 補充題', parts: [],
    statement: ['How many triplets $(x, y, z)$ satisfy $x+y+z=10$ with $x, y, z \\in \\{1, 2, 3, 4, 5\\}$',
      '$1 \\le x \\le 5$、$1 \\le y \\le 5$、$1 \\le z \\le 5$'],
    answers: ['36-3\\cdot6=18'] },
]
const question = (questionId: string) => {
  const found = quiz().questions.find((candidate) => candidate.id === questionId)
  if (found?.type !== 'calculation') throw new Error(`${questionId} must be a calculation question`)
  return found
}

afterEach(cleanup)

describe('PDF-backed 2026 exercises for chapters 1, 3, 5, 7 and 8', () => {
  it('bundles a separate current family of 13 handwriting-capable calculations worth 150 points', () => {
    const value = quiz()
    expect(value).toMatchObject({ id, revision: '1', current: true, title, subject: '離散數學', estimatedMinutes: 120 })
    expect(value.tags).toEqual(['counting', 'permutations', 'combinations', 'stars-and-bars', 'inclusion-exclusion', 'sets',
      'relations', 'equivalence-relations', 'functions', 'stirling-numbers'])
    expect(value.questions.map((q) => q.id)).toEqual(exercises.map((exercise) => exercise.id))
    expect(new Set(value.questions.map((q) => q.id)).size).toBe(13)
    expect(value.questions.map((q) => q.points)).toEqual(exercises.map((exercise) => exercise.points))
    expect(value.questions.every((q) => q.type === 'calculation' && q.drawing?.width === 1200 && q.drawing.height === 900)).toBe(true)
    expect(value.questions.every((q) => q.tags.every((tag) => value.tags.includes(tag)))).toBe(true)
    expect(requiresV4Draft(value)).toBe(true)
    expect(publicationErrors(value)).toEqual([])
    expect(inspectQuiz(value)).toMatchObject({ questionCount: 13, totalDeclaredPoints: 150, deterministicMax: 0,
      calculationDrawingPoints: 150, questionTypes: { single: 0, multiple: 0, 'true-false': 0, fill: 0, calculation: 13, drawing: 0 } })
    expect(quizCatalog.getCurrentQuiz(id)).toBe(value)
    expect(quizCatalog.getQuizRevision(id, '2')).toBeNull()
  })

  it.each(exercises)('$id keeps the source statement, subparts and an answer-free prompt', (exercise) => {
    const q = question(exercise.id)
    expect(q.prompt.split('\n')[0]).toContain(`### ${exercise.source}`)
    for (const fragment of exercise.statement) expect(q.prompt).toContain(fragment)
    for (const part of exercise.parts) expect(q.prompt).toContain(part)
    for (const part of exercise.omitted ?? []) expect(q.prompt).not.toContain(part)
    for (const answer of exercise.answers) expect(q.prompt).not.toContain(answer)
    expect(q.prompt).not.toMatch(/Ans\s*:|Answer\s*:|答案|解法|程式/i)
  })

  it.each(exercises)('$id has the source answer, a worked solution, a scored rubric, rendered math and canonical context', (exercise) => {
    const value = quiz()
    const q = question(exercise.id)
    for (const answer of exercise.answers) expect(q.referenceAnswer).toContain(answer)
    expect(q.solution.length).toBeGreaterThan(q.referenceAnswer.length)
    expect(q.hint).toBeNull()
    expect(q.rubric.length).toBeGreaterThanOrEqual(3)
    expect(q.rubric.every((r) => r.score !== null && Number.isInteger(r.score) && r.score > 0 && r.description.length > 0)).toBe(true)
    expect(q.rubric.reduce((sum, r) => sum + r.score!, 0)).toBe(exercise.points)
    for (const part of exercise.parts) expect(q.rubric.some((r) => r.description.startsWith(part))).toBe(true)
    const content = [q.prompt, q.referenceAnswer, q.solution, ...q.rubric.map((r) => r.description)].join('\n\n')
    expect(content).not.toContain(':::')
    const { container } = render(<Markdown>{content}</Markdown>)
    expect(container.querySelector('.katex-error')).toBeNull()
    expect(container.querySelector('.katex')).not.toBeNull()
    const prose = container.cloneNode(true) as HTMLElement
    prose.querySelectorAll('.katex').forEach((math) => math.remove())
    expect(prose.textContent).not.toMatch(/\$|\\(?:d?binom|d?frac|cdot|times|ge|le|ne|sum|text|mid|cap|cup|math[a-z]+|overline)/)
    const context = AI_QUIZ_CONTEXT.find((c) => String(c.quizId) === id && String(c.questionId) === exercise.id)
    expect(context).toEqual(toTutorContext(value, q))
  })

  it('covers every exercise of the five handouts once, in source order', () => {
    const headings = quiz().questions.map((q) => q.prompt.split('\n')[0])
    expect(headings.map((heading) => heading.replace(/^### /, '').replace(/：.*$/, ''))).toEqual(exercises.map((exercise) => exercise.source))
    const fromChapter = (chapter: number) => headings.filter((heading) => heading.includes(`Ch${chapter} 講義`)).length
    expect([1, 3, 5, 7, 8].map(fromChapter)).toEqual([4, 2, 3, 2, 2])
    const source = Object.values(bundledQuizSources).find((candidate) => candidate.includes(`id="${id}"`))!
    for (const directive of ['question', 'drawing', 'answer', 'solution', 'rubric', 'end']) {
      expect(source.match(new RegExp(`^:::${directive}\\b`, 'gm'))).toHaveLength(13)
    }
    expect(source).not.toMatch(/^:::hint\b/m)
  })

  it('keeps inline math that ends in a subscript from forcing a scrollbar', () => {
    // Prompts such as q08 put formulas like $X_7$ inline; KaTeX leaves a 2px strut after the subscript.
    expect(question('q08').prompt).toMatch(/_[0-9a-z]\$/)
    const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8')
    const inlineMath = css.match(/\.markdown p > \.katex, \.markdown-inline > \.katex, \.markdown-inline > span > \.katex\s*\{([^}]+)\}/)?.[1]
    expect(inlineMath).toMatch(/overflow-x:\s*auto/)
    expect(inlineMath).toMatch(/padding-inline-end:\s*2px/)
  })

  it('scales points with the amount of work instead of giving every exercise the same score', () => {
    const points = (questionId: string) => question(questionId).points
    expect(new Set(quiz().questions.map((q) => q.points)).size).toBeGreaterThan(4)
    // Single-result exercises stay below every exercise with six subparts.
    for (const single of ['q03', 'q13']) for (const six of ['q04', 'q07']) expect(points(single)).toBeLessThan(points(six))
    expect(points('q04')).toBe(Math.max(...quiz().questions.map((q) => q.points)))
  })

  it('adds exactly 13 questions and contexts and leaves the earlier 77-question inventory untouched', () => {
    const all = Object.values(bundledQuizSources).map((source) => parseQuiz(source, true))
    expect(all).toHaveLength(8)
    expect(quizCatalog.current).toHaveLength(6)
    expect(quizCatalog.errors).toEqual([])
    expect(all.flatMap((q) => q.questions)).toHaveLength(90)
    expect(AI_QUIZ_CONTEXT).toHaveLength(90)
    expect(AI_QUIZ_CONTEXT.filter((c) => String(c.quizId) === id)).toHaveLength(13)
    const old = all.filter((q) => q.id !== id).sort((a, b) => `${a.id}/${a.revision}`.localeCompare(`${b.id}/${b.revision}`))
    expect(old.map((q) => `${q.id}/${q.revision}`)).toEqual(['boolean-algebra/1', 'demo/v1-7d7c900e', 'demo/v2-handwriting',
      'discrete-math-ch1-counting-examples/1', 'discrete-math/1', 'discrete-math/2', 'relations/1'])
    expect(sha(old)).toBe('8470e53365ae7b5176d920ec75adf65bc2350b5c07c6a7a3200eaad45d298863')
    expect(sha(old.map((q) => ({ id: q.id, revision: q.revision, questions: q.questions }))))
      .toBe('2f2816a3059416d21f15ff0fd59d5674f823086c5486489350efe84dfd3dd753')
    expect(sha(AI_QUIZ_CONTEXT.filter((c) => String(c.quizId) !== id)))
      .toBe('f065e14da68821e9faf13e3f4529ae8c5d4fe3e02b56098d052bbbe33d5edfea')
  })
})
