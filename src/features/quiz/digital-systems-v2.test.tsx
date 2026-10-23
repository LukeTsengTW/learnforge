import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { Markdown } from '../../components/Markdown'
import { quizMarkdownFields, quizFigureReferences } from '../../lib/quiz-figures'
import { validateV4Publication } from '../../lib/scored-rubric'
import { figuresForQuiz } from './quiz-figures'
import { quizCatalog } from './quiz-loader'

const ids = ['digital-systems-ch1-textbook', 'digital-systems-ch2-textbook']
const quizzes = ids.map(id => quizCatalog.getQuizRevision(id, '2')!)
const question = (chapter: number, id: string) => {
  const q = quizzes[chapter - 1].questions.find(q => q.id === id)
  if (q?.type !== 'calculation') throw new Error(`Missing CH${chapter}/${id}`)
  return q
}
const compact = (text: string) => text.replace(/\\\s|\s/g, '')
const answer = (chapter: number, id: string) => compact(question(chapter, id).referenceAnswer)
const maxtermProduct = (indices: number[]) => indices.map(i =>
  '(' + ['x', 'y', 'z'].map((v, bit) => v + (i >> (2 - bit) & 1 ? "'" : '')).join('+') + ')').join('')
const rows = (bits: number, f: (values: boolean[]) => boolean) =>
  Array.from({ length: 2 ** bits }, (_, i) => i).filter(i =>
    f(Array.from({ length: bits }, (_, bit) => Boolean(i >> (bits - bit - 1) & 1))))

describe('source-only digital systems revision 2', () => {
  it('preserves every historical canonical entry byte for byte', () => {
    const beforeChapter3 = AI_QUIZ_CONTEXT.filter(c => c.quizId !== 'digital-systems-ch3-textbook')
    const historical = beforeChapter3.filter(c => !(ids.includes(c.quizId) && c.revision === '2'))
    expect(historical).toHaveLength(331)
    expect(createHash('sha256').update(JSON.stringify(historical)).digest('hex'))
      .toBe('8b4d344d0c6cbc4c31b7c48a8210ac466b7d7cf7d9688a6ae90561192c6b0090')
    expect(beforeChapter3).toHaveLength(399)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === 'digital-systems-ch3-textbook')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT).toHaveLength(423)
  })

  it.each([0, 1])('keeps Chapter %i metadata, IDs, points and drawing dimensions', index => {
    const next = quizzes[index], prior = quizCatalog.getQuizRevision(next.id, '1')!
    expect(quizCatalog.getCurrentQuiz(next.id)).toBe(next)
    expect(prior.current).toBe(false)
    expect({ ...next, revision: prior.revision, current: prior.current, questions: prior.questions }).toEqual(prior)
    const structure = (q: (typeof next.questions)[number]) => ({ id: q.id, type: q.type,
      points: q.points, tags: q.tags, drawing: 'drawing' in q ? q.drawing : undefined })
    expect(next.questions.map(structure)).toEqual(prior.questions.map(structure))
    expect(next.questions).toHaveLength(index === 0 ? 42 : 26)
    expect(next.questions.reduce((sum, q) => sum + q.points, 0)).toBe(index === 0 ? 206 : 122)
    expect(validateV4Publication(next)).toEqual([])
    for (const q of next.questions) {
      expect(q.rubric.reduce((sum, r) => sum + (r.score ?? 0), 0)).toBe(q.points)
      expect(q.hint).toBeNull()
      // Metadata intentionally remains unchanged; only question fields are English.
      for (const field of quizMarkdownFields({ ...next, description: '', questions: [q] })) {
        expect(field).not.toMatch(/\p{Script=Han}/u)
        expect(field).not.toMatch(/misprint|typo|translator|slide\s+\d|hint:|note:/i)
      }
    }
  })

  it.each([0, 1])('binds Chapter %i text contexts to revision 2 without image payloads', index => {
    const quiz = quizzes[index]
    const contexts = AI_QUIZ_CONTEXT.filter(c => c.quizId === quiz.id && c.revision === '2')
    expect(contexts).toHaveLength(quiz.questions.length)
    for (const [questionIndex, q] of quiz.questions.entries()) {
      if (q.type !== 'calculation') throw new Error('Expected calculation')
      const context = contexts.find(c => c.questionId === q.id)!
      expect(context).toMatchObject({ questionIndex, prompt: q.prompt, solution: q.solution,
        referenceAnswer: q.referenceAnswer, rubric: q.rubric, points: q.points })
      expect(JSON.stringify(context)).not.toMatch(/data:image|<svg|\/assets\//)
      expect(context).not.toHaveProperty('figures')
      expect(context).not.toHaveProperty('imageUrl')
    }
  })

  it.each([0, 1])('renders every Chapter %i field and resolves only bundled figures', index => {
    const quiz = quizzes[index], figures = figuresForQuiz(quiz.id)
    expect(Object.keys(figures)).toHaveLength(index === 0 ? 2 : 8)
    let images = 0, formulas = 0
    for (const field of quizMarkdownFields(quiz)) {
      const refs = quizFigureReferences(field)
      for (const ref of refs) expect(figures).toHaveProperty(ref.url)
      const html = renderToStaticMarkup(<Markdown figures={figures}>{field}</Markdown>)
      expect(html).not.toContain('katex-error')
      expect(html).not.toContain('quiz-figure-unavailable')
      expect(html).not.toMatch(/:::|!\[|\$\$|\$[A-Za-z\\]/)
      expect((html.match(/<img /g) ?? []).length).toBe(refs.length)
      images += refs.length
      formulas += (html.match(/class="katex"/g) ?? []).length
    }
    expect(images).toBeGreaterThanOrEqual(index === 0 ? 4 : 10)
    expect(formulas).toBeGreaterThan(100)
  })

  it('computes the Chapter 1 corrected radix, signed and BCD answers', () => {
    expect(answer(1, 'q02')).toContain(String(4 * 5 ** 3 + 2 * 5 + 1 + 2 / 5))
    expect(answer(1, 'q02')).toContain(String(8 ** 2 + 2 * 8 + 7 + 4 / 8))
    expect(answer(1, 'q02')).not.toContain('655.5')
    expect(answer(1, 'q12')).toContain((135).toString(2))
    expect(answer(1, 'q12')).not.toContain('11100001')
    for (const [qid, values] of [['q29', [19, 7, -7, -19]], ['q31', [15, 7, -7, -15]]] as const) {
      const parts = question(1, qid).referenceAnswer.split(/\r?\n\r?\n/).map(compact)
      for (const [i, n] of values.entries()) expect(parts[i]).toContain(((n + 256) % 256).toString(2).padStart(8, '0'))
    }
    expect(answer(1, 'q20')).toContain((106 - 43).toString(2).padStart(7, '0'))
    expect(question(1, 'q20').solution).toContain("2's complement of }X")
    expect(answer(1, 'q09')).toContain('165.1656\\ldots')
    expect(answer(1, 'q35')).toContain((1).toString(2).padStart(4, '0') + (0).toString(2).padStart(4, '0'))
    expect(answer(1, 'q42')).toContain((66 + 225).toString(2).padStart(10, '0'))
    expect(answer(1, 'q42')).toContain(String(66 + 225))
  })

  it('exhaustively recomputes canonical sets and the corrected maxterms', () => {
    const maxterms = rows(3, ([x, y, z]) => !((!x && y) || (x && z)))
    expect(maxterms).toEqual([0, 1, 4, 6])
    expect(answer(2, 'q22')).toContain(maxtermProduct(maxterms))
    const complement = rows(3, ([x, y, z]) => ![1, 2, 3, 5, 7].includes(Number(x) * 4 + Number(y) * 2 + Number(z)))
    expect(complement).toEqual([0, 4, 6])
    expect(answer(2, 'q18')).toContain(maxtermProduct(complement))
    expect(answer(2, 'q18')).toContain(`F'=\\Sigma(${complement})`)
    expect(answer(2, 'q18')).toContain("(x'+y'+z)")
    expect(answer(2, 'q18')).not.toContain("(x'+y'+z')")
    const minterms = rows(4, ([a, b, c, d]) => a || (!b && c) || (a && d))
    expect(minterms).toEqual([2, 3, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(answer(2, 'q21').replaceAll('\\allowbreak', '')).toContain(`\\Sigma(${minterms})`)
    expect(rows(3, ([x, y, z]) => (x && !y) || (!x && z)))
      .toEqual(rows(3, ([x, y, z]) => (!x && !y && z) || (!x && y && z) || (x && !y)))
  })

  it('keeps circuit-only answers accompanied by explicit gate/input/output rubrics', () => {
    for (const [id, terms] of [
      ['q23', ['AND', 'OR', "BC'", 'AB', 'ACD']],
      ['q24', ['OR', 'AND', 'D', 'BC', "A'+C"]],
      ['q25', ['NAND', 'NOR', 'x', 'y', 'z', 'F']],
      ['q26', ['AND', 'OR', 'AB', 'CD', 'CE']],
    ] as const) {
      const q = question(2, id), rubric = q.rubric.map(r => r.description).join('')
      expect(q.referenceAnswer).toContain('](figures/')
      for (const term of terms) expect(rubric).toContain(term)
    }
    expect(question(2, 'q09').referenceAnswer).toContain('![](figures/pe2-3.svg)')
    expect(question(2, 'q10').prompt).toContain('![FIGURE PE2.4](figures/pe2-4.svg)')
    expect(answer(2, 'q10')).toContain("xy+x'y'")
    expect(question(2, 'q23').rubric.map(r => r.description).join('')).not.toContain("ACD'")
  })
})
