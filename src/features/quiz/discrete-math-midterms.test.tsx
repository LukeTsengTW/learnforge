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

const midtermIds = new Set(['discrete-math-midterm-2021', 'discrete-math-midterm-2023', 'discrete-math-midterm-2024'])
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

const midterms = [
  {
    id: 'discrete-math-midterm-2021', year: '2021', title: '2021 Discrete Mathematics 期中考',
    sourceSha: 'b8b15be59337a0e13829099461c8c8d46f0890b217dbbbe7bca2d4d925bebbb1',
    questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
    types: ['calculation', 'calculation', 'calculation', 'calculation', 'calculation', 'calculation'],
    points: [14, 24, 18, 20, 12, 12],
    correctOptions: {},
    expectedAnswers: { q2: ['350'], q3: ['36', '4096', '81'], q5: ['10'], q6: ['1314'] },
  },
  {
    id: 'discrete-math-midterm-2023', year: '2023', title: '2023 Discrete Mathematics 期中考',
    sourceSha: '3af91ddeb6022ba672c512a9e6a85e22d76e6e86bbc314c030baf63ade796fd2',
    questionIds: ['q1', 'q2-i', 'q2-ii', 'q2-iii', 'q3', 'q4', 'q5', 'q6', 'q7'],
    types: ['calculation', 'single', 'single', 'single', 'calculation', 'calculation', 'calculation', 'calculation', 'calculation'],
    points: [14, 6, 6, 6, 14, 15, 17, 12, 10],
    correctOptions: { 'q2-i': 'b', 'q2-ii': 'd', 'q2-iii': 'a' },
    expectedAnswers: { q1: ['369600', '1680'], q4: ['11664'], q6: ['246'], q7: ['216'] },
  },
  {
    id: 'discrete-math-midterm-2024', year: '2024', title: '2024 Discrete Mathematics 期中考',
    sourceSha: '90bcc2968a3974aec6fa63beecdc8fac552eef87b130fdd0a9af628db103c50a',
    questionIds: ['q1', 'q2-i', 'q2-ii', 'q2-iii', 'q2-iv', 'q3', 'q4', 'q5', 'q6', 'q7'],
    types: ['calculation', 'single', 'single', 'single', 'single', 'calculation', 'calculation', 'calculation', 'calculation', 'calculation'],
    points: [12, 6, 6, 6, 6, 12, 18, 10, 12, 12],
    correctOptions: { 'q2-i': 'b', 'q2-ii': 'e', 'q2-iii': 'c', 'q2-iv': 'b' },
    expectedAnswers: { q1: ['120'], q3: ['685440'], q4: ['216'], q7: ['134'] },
  },
] as const

const quizFor = (id: string) => {
  const quiz = quizCatalog.getQuizRevision(id, '1')
  if (!quiz) throw new Error(`Missing bundled revision 1 for ${id}`)
  return quiz
}
const sourceFor = (id: string) => {
  const source = Object.values(bundledQuizSources).find((value) => value.includes(`id="${id}"`))
  if (!source) throw new Error(`Missing source for ${id}`)
  return source
}

afterEach(cleanup)

describe.each(midterms)('$year Discrete Mathematics midterm', (spec) => {
  const quiz = quizFor(spec.id)
  const source = sourceFor(spec.id)

  it('publishes the exact ordered 90-minute, 100-point revision', () => {
    expect(quiz).toMatchObject({ id: spec.id, revision: '1', current: true, title: spec.title,
      subject: '離散數學', estimatedMinutes: 90 })
    expect(quiz.questions.map(({ id }) => id)).toEqual(spec.questionIds)
    expect(quiz.questions.map(({ type }) => type)).toEqual(spec.types)
    expect(quiz.questions.map(({ points }) => points)).toEqual(spec.points)
    expect(quiz.questions.reduce((sum, question) => sum + question.points, 0)).toBe(100)
    expect(quiz.tags.length).toBeGreaterThan(0)
    expect(new Set(quiz.questions.flatMap((question) => question.tags))).toEqual(new Set(quiz.tags))
    expect(requiresV4Draft(quiz)).toBe(true)
    expect(publicationErrors(quiz)).toEqual([])
    expect(quizCatalog.getCurrentQuiz(spec.id)).toBe(quiz)
    expect(quizCatalog.getQuizRevision(spec.id, '2')).toBeNull()
    expect(quizCatalog.errors).toEqual([])

    const calculations = quiz.questions.filter((question) => question.type === 'calculation')
    expect(calculations).toHaveLength(spec.types.filter((type) => type === 'calculation').length)
    for (const question of calculations) {
      expect(question.drawing).toEqual({ width: 1200, height: 900 })
      expect(question.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)).toBe(question.points)
    }
    const deterministicMax = quiz.questions.reduce((sum, question) => sum + (question.type === 'single' ? question.points : 0), 0)
    expect(inspectQuiz(quiz)).toMatchObject({ questionCount: spec.questionIds.length, totalDeclaredPoints: 100, deterministicMax })

    for (const [questionId, correctOptionId] of Object.entries(spec.correctOptions)) {
      const question = quiz.questions.find((candidate) => candidate.id === questionId)
      expect(question).toMatchObject({ type: 'single', correctOptionId })
    }
  })

  it('pins the source and verifies key calculation answers', () => {
    expect(createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex')).toBe(spec.sourceSha)
    for (const [questionId, expected] of Object.entries(spec.expectedAnswers)) {
      const question = quiz.questions.find((candidate) => candidate.id === questionId)
      expect(question?.type).toBe('calculation')
      if (!question || question.type !== 'calculation') throw new Error(`Expected ${questionId} to be a calculation`)
      const answer = question.referenceAnswer.replace(/\s/g, '')
      for (const fragment of expected) expect(answer).toContain(fragment)
    }

    const calculationCount = spec.types.filter((type) => type === 'calculation').length
    for (const directive of ['question', 'solution', 'end']) {
      expect(source.match(new RegExp('^:::' + directive + '\\b', 'gm'))).toHaveLength(spec.questionIds.length)
    }
    for (const directive of ['drawing', 'answer', 'rubric']) {
      expect(source.match(new RegExp('^:::' + directive + '\\b', 'gm'))).toHaveLength(calculationCount)
    }
    expect(source).not.toMatch(/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/m)
    expect(source).not.toMatch(/<\/?(?:script|style|img|iframe|video|audio|svg|div|span)\b/i)
  })

  it('renders every source formula and matches each canonical tutor context', () => {
    const formulas = [...source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)].map((match) => match[0])
    expect(formulas.length).toBeGreaterThan(0)
    const { container } = render(<Markdown>{formulas.join('\n\n')}</Markdown>)
    expect([...container.querySelectorAll('.katex-error')].map((error) => error.textContent)).toEqual([])
    expect(container.querySelectorAll('.katex')).toHaveLength(formulas.length)

    for (const question of quiz.questions) {
      expect(AI_QUIZ_CONTEXT.find((context) => context.quizId === spec.id && context.revision === '1'
        && context.questionId === question.id)).toEqual(toTutorContext(quiz, question))
    }
  })
})

describe('Discrete Mathematics midterm context integration', () => {
  it('adds 25 canonical contexts while preserving all 145 previously shipped contexts byte-for-byte', () => {
    const existing = AI_QUIZ_CONTEXT.filter((context) => context.quizId !== 'digital-systems-ch1-textbook'
      && context.quizId !== 'digital-systems-ch2-textbook'
      && context.quizId !== 'economics-ch1-4-exercises'
      && !midtermIds.has(context.quizId))
    expect(AI_QUIZ_CONTEXT.filter(c => !(['digital-systems-ch1-textbook', 'digital-systems-ch2-textbook'].includes(c.quizId) && c.revision === '2'))).toHaveLength(331)
    expect(AI_QUIZ_CONTEXT).toHaveLength(399)
    expect(existing).toHaveLength(145)
    expect(sha(existing)).toBe('8719200237f249a46e43a20a92050db6ab0ed3aa84405485147c3af6976fb368')
    for (const spec of midterms) {
      expect(AI_QUIZ_CONTEXT.filter((context) => context.quizId === spec.id && context.revision === '1'))
        .toHaveLength(spec.questionIds.length)
    }
  })
})
