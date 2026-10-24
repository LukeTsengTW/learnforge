// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createHash } from 'node:crypto'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { Markdown } from '../../components/Markdown'
import { validateV4Publication } from '../../lib/scored-rubric'
import { bundledQuizSources, quizCatalog } from './quiz-loader'

const id = 'digital-systems-ch1-textbook'
// Later families have their own full-baseline guards in the Chapter 2/3 tests.
const later = 'digital-systems-ch2-textbook'
const newest = 'digital-systems-ch3-textbook'
const quiz = quizCatalog.getQuizRevision(id, '1')!
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const question = (questionId: string) => {
  const result = quiz.questions.find(q => q.id === questionId)
  if (result?.type !== 'calculation') throw new Error(`Missing calculation ${questionId}`)
  return result
}

afterEach(cleanup)

describe('source-audited digital systems chapter 1 integration', () => {
  it('publishes the complete source order, scored rubric and v4 handwriting metadata', () => {
    expect(quiz).toMatchObject({ id, revision: '1', current: false,
      title: '【課本題目】數位系統導論 - Chapter 1', subject: '數位系統導論', estimatedMinutes: 170 })
    expect(quizCatalog.current.filter(entry => entry.quiz.id === id)).toHaveLength(1)
    expect(quizCatalog.current.find(entry => entry.quiz.id === id))
      .toMatchObject({ questionCount: 42, totalPoints: 206, maxPoints: 0 })
    expect(quiz.questions.map(q => q.id)).toEqual([
      'q01', 'q02', 'q03', 'q04', 'q40', 'q05', 'q06', 'q07', 'q08', 'q09', 'q41',
      ...Array.from({ length: 29 }, (_, index) => `q${String(index + 10).padStart(2, '0')}`), 'q42', 'q39',
    ])
    expect(new Set(quiz.questions.map(q => q.id)).size).toBe(42)
    expect(validateV4Publication(quiz)).toEqual([])
    expect(quiz.questions.filter(q => q.type === 'calculation' && q.drawing)).toHaveLength(40)
    for (const q of quiz.questions) {
      expect(q.type).toBe('calculation')
      expect(q.prompt.trim().length).toBeGreaterThan(0)
      expect(q.solution.trim().length).toBeGreaterThan(0)
      expect(q.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)).toBe(q.points)
    }
  })

  it('preserves all fourteen prior source revisions and all 263 prior canonical contexts', () => {
    const priorSources = Object.entries(bundledQuizSources)
      .filter(([file]) => !file.includes(`/${id}/`) && !file.includes(`/${later}/`) && !file.includes(`/${newest}/`)
        && !file.includes('/digital-systems-ch4-textbook/') && !file.includes('/digital-systems-ch1-ch4-textbook-exercises/'))
      .map(([file, source]) => [file.split('/quizzes/')[1], source.replaceAll('\r\n', '\n')])
      .sort(([a], [b]) => a.localeCompare(b))
    expect(priorSources).toHaveLength(14)
    expect(sha(priorSources)).toBe('5c6047807151b538788521a5dbc13ec5227a5e88e6ea40d0bdd39096d6ac2e14')
    const priorContexts = AI_QUIZ_CONTEXT.filter(c => c.quizId !== id && c.quizId !== later && c.quizId !== newest
      && c.quizId !== 'digital-systems-ch4-textbook' && c.quizId !== 'digital-systems-ch1-ch4-textbook-exercises')
    expect(priorContexts).toHaveLength(263)
    expect(sha(priorContexts)).toBe('9898ee86b5422e9ce095a0e3f6972905dcebbce53dba4afb9ca1ec0fc6a14c41')
    const beforeChapter3 = AI_QUIZ_CONTEXT.filter(c => c.quizId !== newest && c.quizId !== 'digital-systems-ch4-textbook' && c.quizId !== 'digital-systems-ch1-ch4-textbook-exercises')
    expect(beforeChapter3.filter(c => !([id, later].includes(c.quizId) && c.revision === '2'))).toHaveLength(331)
    expect(beforeChapter3).toHaveLength(399)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === newest && c.revision === '1')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT.filter(c => c.quizId === newest && c.revision === '2')).toHaveLength(24)
    expect(AI_QUIZ_CONTEXT).toHaveLength(504)
  })

  it('binds one generated context to every exact question and its actual source index', () => {
    const contexts = AI_QUIZ_CONTEXT.filter(c => c.quizId === id && c.revision === '1')
    expect(contexts).toHaveLength(42)
    expect(new Set(contexts.map(c => c.questionId)).size).toBe(42)
    for (const [index, q] of quiz.questions.entries()) {
      if (q.type !== 'calculation') throw new Error('Expected calculation')
      const context = contexts.find(c => c.questionId === q.id)
      expect(context).toMatchObject({ questionIndex: index,
        prompt: q.prompt, solution: q.solution, rubric: q.rubric, points: q.points,
        referenceAnswer: q.referenceAnswer })
      if (q.drawing) expect(context).toMatchObject({ drawing: q.drawing })
      else expect(context).not.toHaveProperty('drawing')
    }
  })

  it('keeps mathematically corrected answers distinct from source typo notes', () => {
    expect(question('q02').referenceAnswer).toContain('511.4')
    expect(question('q02').referenceAnswer).not.toContain('511.5')
    expect(question('q02').solution).toContain('655.5')
    expect(question('q12').referenceAnswer).toContain((135).toString(2))
    expect(question('q12').referenceAnswer).not.toContain('11100001')
    for (const [index, n] of [15, 7, -7, -15].entries()) {
      const encoding = ((n + 256) % 256).toString(2).padStart(8, '0')
      expect(question('q31').referenceAnswer.split(/\r?\n\r?\n/)[index]).toContain(encoding)
    }
    expect(question('q31').solution).toContain('投影片答案誤植')
    expect(question('q21').solution).toContain('譯者更正')
    expect(question('q21').referenceAnswer).toContain((106 - 43).toString(2).padStart(7, '0'))
  })

  it('requires nonterminating octal prefixes, complete BCD groups and ten-bit register data', () => {
    expect(question('q08').referenceAnswer).toContain('406517\\ldots')
    expect(question('q09').referenceAnswer).toContain('截斷')
    expect(question('q09').referenceAnswer).toContain('尚未終止')
    expect(question('q35').referenceAnswer).toContain('0001 0000')
    expect(question('q42').prompt).toContain('10-bit')
    expect(question('q42').referenceAnswer).toContain((66 + 225).toString(2).padStart(10, '0'))
    expect(question('q22').prompt).toContain('10001001')
    expect(question('q39').prompt).toContain('各寬 1 V')
  })

  it('renders every actual prompt, reference answer and nonempty solution without math errors or raw delimiters', () => {
    const view = render(<>{quiz.questions.map(q => <section key={q.id} data-question-id={q.id}>
      <Markdown>{q.prompt}</Markdown><Markdown>{question(q.id).referenceAnswer}</Markdown><Markdown>{q.solution}</Markdown>
    </section>)}</>)
    expect(view.container.querySelectorAll('section')).toHaveLength(42)
    expect(view.container.querySelectorAll('.katex').length).toBeGreaterThan(150)
    expect(view.container.querySelectorAll('.katex-error')).toHaveLength(0)
    expect(view.container.textContent).not.toContain(':::')
    expect(view.container.textContent).not.toContain('$')
  })
})
