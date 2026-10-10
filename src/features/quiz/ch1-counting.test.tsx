// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Markdown } from '../../components/Markdown'
import { parseQuiz } from '../../lib/quiz-parser'
import { requiresV4Draft } from '../../lib/draft-v4'
import { inspectQuiz, publicationErrors } from '../author/authoring-core'
import { toTutorContext } from '../../../scripts/ai-quiz-context'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { bundledQuizSources, quizCatalog } from './quiz-loader'

const id = 'discrete-math-ch1-counting-examples'
const title = '離散數學第一章：計數的基本原理－例題練習'
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const quiz = () => {
  const value = quizCatalog.getQuizRevision(id, '1')
  expect(value, 'the new Chapter 1 family must be bundled').not.toBeNull()
  return value!
}
const anchors = [
  ['q01', ['90']], ['q02', ['48']], ['q03', ['3{,}276{,}000', '6{,}760{,}000']],
  ['q04', ['6']], ['q05', ['12']], ['q06', ['8!', '6720', '8^{12}']],
  ['q07', ['6']], ['q08', ['10']], ['q09', ['25{,}200', '840']], ['q10', ['56']],
  ['q11', ['3']], ['q12', ['80{,}089{,}128']], ['q13', ['4{,}431{,}613{,}550', '1{,}087{,}836{,}750']],
  ['q14', ['831{,}600', '423{,}360']], ['q15', ['6']], ['q16', ['10']], ['q17', ['21', '6048']],
  ['q18', ['12']], ['q19', ['210', '42', '35']], ['q20', ['6']], ['q21', ['10']],
  ['q22', ['120']], ['q23', ['3003']], ['q24', ['286']], ['q25', ['4']], ['q26', ['1540']],
] as const

afterEach(cleanup)

describe('PDF-backed Chapter 1 counting practice', () => {
  it('bundles a separate current family with exactly 26 capable calculations', () => {
    const value = quiz()
    expect(value).toMatchObject({ id, revision: '1', current: true, title, subject: '離散數學' })
    expect(value.tags).toEqual(['counting', 'sum-rule', 'product-rule', 'permutations', 'combinations',
      'binomial-theorem', 'multinomial-theorem', 'stars-and-bars'])
    expect(value.questions.map((q) => q.id)).toEqual(anchors.map(([questionId]) => questionId))
    expect(new Set(value.questions.map((q) => q.id)).size).toBe(26)
    expect(value.questions.every((q) => q.type === 'calculation' && q.drawing?.width === 1200 && q.drawing.height === 900)).toBe(true)
    expect(requiresV4Draft(value)).toBe(true)
    expect(publicationErrors(value)).toEqual([])
    expect(inspectQuiz(value)).toMatchObject({ questionCount: 26, totalDeclaredPoints: 150, deterministicMax: 0,
      calculationDrawingPoints: 150, questionTypes: { single: 0, multiple: 0, 'true-false': 0, fill: 0, calculation: 26, drawing: 0 } })
    expect(quizCatalog.getCurrentQuiz(id)).toBe(value)
  })

  it.each(anchors)('%s retains source answers, valid scored reasoning, rendered math and canonical context', (questionId, answers) => {
    const value = quiz()
    const q = value.questions.find((question) => question.id === questionId)!
    expect(q.type).toBe('calculation')
    if (q.type !== 'calculation') throw new Error('Expected calculation')
    for (const answer of answers) expect(q.referenceAnswer).toContain(answer)
    expect(q.solution.length).toBeGreaterThan(q.referenceAnswer.length)
    expect(q.rubric.length).toBeGreaterThanOrEqual(2)
    expect(q.rubric.every((r) => r.score !== null && r.score > 0 && r.description.length > 0)).toBe(true)
    expect(q.rubric.reduce((sum, r) => sum + r.score!, 0)).toBe(q.points)
    const content = [q.prompt, q.referenceAnswer, q.solution, ...q.rubric.map((r) => r.description)].join('\n\n')
    expect(content).not.toContain(':::')
    const { container } = render(<Markdown>{content}</Markdown>)
    expect(container.querySelector('.katex-error')).toBeNull()
    expect(container.querySelector('.katex')).not.toBeNull()
    const prose = container.cloneNode(true) as HTMLElement
    prose.querySelectorAll('.katex').forEach((math) => math.remove())
    expect(prose.textContent).not.toMatch(/\$|\\(?:binom|frac|cdot|times|ge|le|sum|text)/)
    const context = AI_QUIZ_CONTEXT.find((c) => String(c.quizId) === id && String(c.questionId) === questionId)
    expect(context).toEqual(toTutorContext(value, q))
  })

  it('preserves source corrections, visible subparts, and answer-free prompts', () => {
    const questions = quiz().questions
    const prompt = (qid: string) => questions.find((q) => q.id === qid)!.prompt
    expect(prompt('q01')).toContain('社會學')
    expect(prompt('q01')).toContain('人類學')
    expect(prompt('q01')).not.toMatch(/數學教科書|人文/)
    expect(prompt('q02')).toContain('中央大學戲劇社')
    expect(prompt('q02')).toContain('春季')
    expect(prompt('q13')).toContain('(a)')
    expect(prompt('q13')).toContain('(c)')
    expect(prompt('q13')).not.toContain('(b)')
    expect(prompt('q19')).toContain('(a)')
    expect(prompt('q19')).not.toMatch(/\([bc]\)/)
    expect(prompt('q26')).toContain('print(i * j + k)')
    expect(prompt('q26')).not.toContain('print(i * j * k)')
    for (const q of questions) {
      expect(q.prompt).not.toMatch(/(?:答案|Ans\s*:|=\s*(?:1540|6720|6048|3003|286|120|90|48|56))|423[,{]|80[,{]089/i)
    }
    const source = Object.values(bundledQuizSources).find((s) => s.includes(`id="${id}"`))!
    for (const directive of ['question', 'drawing', 'answer', 'solution', 'rubric', 'end']) {
      expect(source.match(new RegExp(`^:::${directive}\\b`, 'gm'))).toHaveLength(26)
    }
  })

  it('adds only 26 contexts/questions and preserves the immutable 51-question baseline', () => {
    // Families bundled after this one are pinned by their own tests; they stay out of the 51-question baseline.
    const later = new Set(['discrete-math-exercises-2026'])
    const all = Object.values(bundledQuizSources).map((source) => parseQuiz(source, true)).filter((q) => !later.has(q.id))
    const contexts = AI_QUIZ_CONTEXT.filter((c) => !later.has(String(c.quizId)))
    expect(all).toHaveLength(7)
    expect(quizCatalog.current.filter(({ quiz: current }) => !later.has(current.id))).toHaveLength(5)
    expect(all.flatMap((q) => q.questions)).toHaveLength(77)
    expect(contexts).toHaveLength(77)
    expect(contexts.filter((c) => String(c.quizId) === id)).toHaveLength(26)
    const old = all.filter((q) => q.id !== id).sort((a, b) => `${a.id}/${a.revision}`.localeCompare(`${b.id}/${b.revision}`))
    expect(sha(old)).toBe('0608d5d8a6bd25240d31ddafbde05bcfc1aaebd9d833c4f388c104eba286317b')
    expect(sha(old.map((q) => ({ id: q.id, revision: q.revision, questions: q.questions }))))
      .toBe('9845e9529140438658437b80710472f8369e2a5fa7f356232792e8a8fe5c0135')
    expect(sha(contexts.filter((c) => String(c.quizId) !== id)))
      .toBe('ed5c44fcfcbbd916fcce2df10c9e6728f3f2fefafc01c8cbbef304e3ba4f0c11')
    // Git may check out CRLF on Windows; pin the immutable content across checkout EOLs.
    const midtermSource = readFileSync('src/content/quizzes/discrete-math/v2.quiz.md', 'utf8').replace(/\r\n/g, '\n')
    expect(createHash('sha256').update(midtermSource).digest('hex'))
      .toBe('eb96ed84ef8259797838048e4348e8d35fcb2feb447e8807b3bbf42b43e168af')
    expect(quizCatalog.getCurrentQuiz('discrete-math')).toMatchObject({ revision: '2', current: true,
      title: '2025 Discrete Mathematics 期中考' })
    expect(quizCatalog.getQuizRevision('discrete-math', '3')).toBeNull()
  })
})
