// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createHash } from 'node:crypto'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { Markdown } from '../../components/Markdown'
import { validateV4Publication } from '../../lib/scored-rubric'
import { bundledQuizSources, quizCatalog } from './quiz-loader'

const id = 'digital-systems-ch2-textbook'
// Chapter 3 pins all eighteen pre-existing source revisions and 399 contexts.
const later = 'digital-systems-ch3-textbook'
const quiz = quizCatalog.getQuizRevision(id, '1')!
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const question = (questionId: string) => {
  const result = quiz.questions.find(q => q.id === questionId)
  if (result?.type !== 'calculation') throw new Error(`Missing calculation ${questionId}`)
  return result
}
const rows = (f: (x: number, y: number, z: number) => boolean) =>
  Array.from({ length: 8 }, (_, i) => i).filter(i => f(i >> 2 & 1, i >> 1 & 1, i & 1))

afterEach(cleanup)

describe('source-audited digital systems chapter 2 integration', () => {
  it('publishes the complete source order, scored rubric and v4 handwriting metadata', () => {
    expect(quiz).toMatchObject({ id, revision: '1', current: false,
      title: '【課本題目】數位系統導論 - Chapter 2', subject: '數位系統導論', estimatedMinutes: 115 })
    expect(quizCatalog.current.filter(entry => entry.quiz.id === id)).toHaveLength(1)
    expect(quizCatalog.current.find(entry => entry.quiz.id === id))
      .toMatchObject({ questionCount: 26, totalPoints: 122, maxPoints: 0 })
    expect(quiz.questions.map(q => q.id)).toEqual([
      ...Array.from({ length: 20 }, (_, index) => `q${String(index + 1).padStart(2, '0')}`),
      'q26', 'q21', 'q22', 'q23', 'q24', 'q25',
    ])
    expect(new Set(quiz.questions.map(q => q.id)).size).toBe(26)
    expect(validateV4Publication(quiz)).toEqual([])
    expect(quiz.questions.filter(q => q.type === 'calculation' && q.drawing)).toHaveLength(26)
    for (const q of quiz.questions) {
      expect(q.type).toBe('calculation')
      expect(q.prompt.trim().length).toBeGreaterThan(0)
      expect(q.solution.trim().length).toBeGreaterThan(0)
      expect(q.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)).toBe(q.points)
    }
  })

  it('preserves all fifteen prior source revisions and all 305 prior canonical contexts', () => {
    const priorSources = Object.entries(bundledQuizSources)
      .filter(([file]) => !file.includes(`/${id}/`) && !file.includes(`/${later}/`) && !file.includes('/digital-systems-ch4-textbook/')
        && !file.endsWith('/digital-systems-ch1-textbook/v2.quiz.md'))
      // The original baseline contained Chapter 1 revision 1 as current.
      .map(([file, source]) => [file.split('/quizzes/')[1], source.replaceAll('\r\n', '\n')
        .replace(/(id="digital-systems-ch1-textbook"[^\n]*current=")false"/, '$1true"')])
      .sort(([a], [b]) => a.localeCompare(b))
    expect(priorSources).toHaveLength(15)
    expect(sha(priorSources)).toBe('6b840830fe31f2edcdebabc3feb374d77dff9820d3bc952675f47dc590a3cfa8')
    const priorContexts = AI_QUIZ_CONTEXT.filter(c => c.quizId !== id && c.quizId !== later && c.quizId !== 'digital-systems-ch4-textbook'
      && !(c.quizId === 'digital-systems-ch1-textbook' && c.revision === '2'))
    expect(priorContexts).toHaveLength(305)
    expect(sha(priorContexts)).toBe('e840396c9f3d8cc3a43664b24fa7ad83762b902b764d31b5c0ff663adaa46db4')
    const beforeChapter3 = AI_QUIZ_CONTEXT.filter(c => c.quizId !== later && c.quizId !== 'digital-systems-ch4-textbook')
    expect(beforeChapter3.filter(c => !(['digital-systems-ch1-textbook', id].includes(c.quizId) && c.revision === '2'))).toHaveLength(331)
    expect(beforeChapter3).toHaveLength(399)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === later && c.revision === '1')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === later && c.revision === '2')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT).toHaveLength(462)
  })

  it('binds one generated context to every exact question and its actual source index', () => {
    const contexts = AI_QUIZ_CONTEXT.filter(c => c.quizId === id && c.revision === '1')
    expect(contexts).toHaveLength(26)
    expect(new Set(contexts.map(c => c.questionId)).size).toBe(26)
    for (const [index, q] of quiz.questions.entries()) {
      if (q.type !== 'calculation') throw new Error('Expected calculation')
      const context = contexts.find(c => c.questionId === q.id)
      expect(context).toMatchObject({ questionIndex: index,
        prompt: q.prompt, solution: q.solution, rubric: q.rubric, points: q.points,
        referenceAnswer: q.referenceAnswer, drawing: q.drawing })
    }
  })

  it('keeps the corrected maxterm answers distinct from the slide typos', () => {
    // PE 2.7: F = Σ(1,2,3,5,7); PE 2.11: F = x'y + xz.
    expect(rows((x, y, z) => ![1, 2, 3, 5, 7].includes(x * 4 + y * 2 + z))).toEqual([0, 4, 6])
    expect(question('q18').referenceAnswer).toContain("\\Pi(0,4,6)=(x+y+z)(x'+y+z)(x'+y'+z)")
    expect(question('q18').referenceAnswer).not.toContain("(x'+y'+z')")
    expect(rows((x, y, z) => !((!x && y) || (x && z)))).toEqual([0, 1, 4, 6])
    expect(question('q22').referenceAnswer).toContain("\\Pi(0,1,4,6)=(x+y+z)(x+y+z')(x'+y+z)(x'+y'+z)")
    expect(question('q22').referenceAnswer).not.toContain("(x'+y+z')")
    for (const q of ['q18', 'q22']) expect(question(q).solution).toContain('投影片答案誤植')
  })

  it('follows the slide annotations for the PE 2.3, 2.4 and 2.12 diagrams and adds the F3 worked example', () => {
    expect(question('q09').solution).toContain('對調')
    expect(question('q10').prompt).toContain('**NOR**')
    expect(question('q10').referenceAnswer).toContain("xy+x'y'")
    expect(question('q23').referenceAnswer).toContain('3-input AND（$A$、$C$、$D$）輸出 $ACD$')
    expect(question('q23').referenceAnswer).not.toContain("ACD'")
    expect(question('q26').prompt).toContain('F_3=AB+C(D+E)')
    expect(question('q26').referenceAnswer).toContain('F_3=AB+CD+CE')
  })

  it('renders every actual prompt, reference answer and nonempty solution without math errors or raw delimiters', () => {
    const view = render(<>{quiz.questions.map(q => <section key={q.id} data-question-id={q.id}>
      <Markdown>{q.prompt}</Markdown><Markdown>{question(q.id).referenceAnswer}</Markdown><Markdown>{q.solution}</Markdown>
    </section>)}</>)
    expect(view.container.querySelectorAll('section')).toHaveLength(26)
    expect(view.container.querySelectorAll('.katex').length).toBeGreaterThan(150)
    expect(view.container.querySelectorAll('.katex-error')).toHaveLength(0)
    expect(view.container.textContent).not.toContain(':::')
    expect(view.container.textContent).not.toContain('$')
  })
})
