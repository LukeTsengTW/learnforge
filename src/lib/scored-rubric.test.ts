import { describe, expect, it } from 'vitest'
import demoSource from '../content/quizzes/demo/v1.quiz.md?raw'
import booleanSource from '../content/quizzes/boolean-algebra/v1.quiz.md?raw'
import relationsSource from '../content/quizzes/relations/v1.quiz.md?raw'
import type { CalculationQuestion, DrawingConfig } from '../models/quiz'
import { parseQuiz } from './quiz-parser'
import { validateV3Publication, validateV4Publication } from './scored-rubric'

const quiz = parseQuiz(demoSource)
const calculation = quiz.questions.find((question) => question.type === 'calculation')!
const drawingQuestion = quiz.questions.find((question) => question.type === 'drawing')!
const withCalculation = (overrides: Partial<CalculationQuestion> = {}) => ({
  ...quiz, questions: [{ ...calculation, ...overrides }],
})

describe('versioned publication gates', () => {
  it.each([
    ['demo', demoSource], ['boolean-algebra', booleanSource], ['relations', relationsSource],
  ])('keeps the current bundled %s quiz valid for v3 publication', (_, source) => {
    expect(validateV3Publication(parseQuiz(source, true))).toEqual([])
  })

  it('keeps the current text-only calculation valid without adding defaults', () => {
    const input = withCalculation()
    const before = structuredClone(input)
    expect(validateV3Publication(input)).toEqual([])
    expect(validateV4Publication(input)).toEqual([])
    expect(input).toEqual(before)
    expect(input.questions[0]).not.toHaveProperty('drawing')
    expect(input.questions[0]).toMatchObject({ id: 'q6', type: 'calculation' })
  })

  it.each([100, 800, 1200])('allows calculation drawing capability only through v4 at supported dimensions: %i', (size) => {
    const input = withCalculation({ drawing: { width: size, height: size } })
    expect(validateV3Publication(input)).toEqual(['q6: calculation drawing capability 需要 ai-grading-v4。'])
    expect(validateV4Publication(input)).toEqual([])
  })

  it.each([99, 1201, 2000, 2001, 800.5, NaN, Infinity])('rejects unsupported future dimensions: %s', (size) => {
    for (const drawing of [{ width: size, height: 600 }, { width: 800, height: size }]) {
      const errors = validateV4Publication(withCalculation({ drawing }))
      expect(errors).toEqual(expect.arrayContaining([expect.stringMatching(/q6.*v4 drawing config.*100 至 1200/)]))
    }
  })

  it('rejects malformed future configs supplied programmatically', () => {
    for (const drawing of [{ width: 800 }, { width: '800', height: 600 }, { width: 800, height: 600, model: 'forged' }]) {
      expect(validateV4Publication(withCalculation({ drawing: drawing as DrawingConfig }))).not.toEqual([])
    }
  })

  it('keeps historical parsing and v3 drawing publication range separate from v4 eligibility', () => {
    const historical = parseQuiz(demoSource.replace('width=800', 'width=2000'))
    expect(historical.questions.find((question) => question.type === 'drawing')?.drawing.width).toBe(2000)
    expect(validateV3Publication(historical)).toEqual([])
    expect(validateV4Publication(historical)).toEqual([
      'q7: v4 drawing config 的寬高必須為 100 至 1200 的整數。',
    ])
  })

  it('parses 2000x2000 calculation capability but rejects it for separate v3 and v4 reasons', () => {
    const start = demoSource.indexOf(':::question id="q6"')
    const source = demoSource.slice(0, start) + demoSource.slice(start)
      .replace(':::end', ':::drawing\nwidth=2000\nheight=2000\n:::end')
    const future = parseQuiz(source, true)
    expect(future.questions.find((question) => question.id === 'q6'))
      .toMatchObject({ type: 'calculation', drawing: { width: 2000, height: 2000 } })
    expect(validateV3Publication(future)).toEqual(['q6: calculation drawing capability 需要 ai-grading-v4。'])
    expect(validateV4Publication(future)).toEqual(['q6: v4 drawing config 的寬高必須為 100 至 1200 的整數。'])
  })

  it('continues validating actual drawing questions using the shared future bounds', () => {
    expect(validateV3Publication({ ...quiz, questions: [drawingQuestion] })).toEqual([])
    expect(validateV4Publication({ ...quiz, questions: [drawingQuestion] })).toEqual([])
    expect(validateV4Publication({ ...quiz, questions: [{ ...drawingQuestion, drawing: { width: 1201, height: 600 } }] }))
      .not.toEqual([])
  })

  it('keeps v3 drawing dimension errors out of the independent v4 gate', () => {
    const input = { ...quiz, questions: [{ ...drawingQuestion, drawing: { width: 2001, height: 600 } }] }
    expect(validateV3Publication(input)).toEqual(['q7: drawing config 的寬高必須介於 100 至 2000。'])
    expect(validateV4Publication(input)).toEqual(['q7: v4 drawing config 的寬高必須為 100 至 1200 的整數。'])
  })

  describe('M4.2 v4 exact rubric precision', () => {
    const V4_PRECISION = 'q6: v4 配分與 rubric 分數必須為最多 8 位小數，且 rubric 總分須與題目配分完全相等。'
    const scored = (points: number, scores: number[]) => ({ points,
      rubric: scores.map((score, index) => ({ description: `Criterion ${index + 1}`, score })) })

    it('accepts an exact fractional v4 rubric (0.3 = 0.1 + 0.2)', () => {
      expect(validateV4Publication(withCalculation(scored(0.3, [0.1, 0.2])))).toEqual([])
      expect(validateV4Publication(withCalculation({ ...scored(0.3, [0.1, 0.2]), drawing: { width: 800, height: 600 } }))).toEqual([])
    })

    it.each([
      ['close-but-not-equal total', scored(0.3, [0.1, 0.20000001])],
      ['non-canonical criterion', scored(0.3, [0.100000001, 0.2])],
      ['non-canonical question points', scored(0.3000000001, [0.1, 0.2])],
    ])('rejects %s for v4 while v3 keeps its historical tolerance', (_label, overrides) => {
      const input = withCalculation(overrides)
      expect(validateV3Publication(input)).toEqual([])
      expect(validateV4Publication(input)).toEqual([V4_PRECISION])
      expect(validateV4Publication(withCalculation({ ...overrides, drawing: { width: 800, height: 600 } }))).toEqual([V4_PRECISION])
    })

    it('applies the same rule to an actual DrawingQuestion under v4 only', () => {
      const input = { ...quiz, questions: [{ ...drawingQuestion, ...scored(0.3, [0.1, 0.20000001]) }] }
      expect(validateV3Publication(input)).toEqual([])
      expect(validateV4Publication(input)).toEqual(['q7: v4 配分與 rubric 分數必須為最多 8 位小數，且 rubric 總分須與題目配分完全相等。'])
    })
  })

  it.each([
    { referenceAnswer: '' }, { solution: ' \n' }, { rubric: [] },
    { rubric: calculation.rubric.map((criterion) => ({ ...criterion, score: null })) },
    { rubric: [{ description: 'Wrong total', score: 1 }] },
    { rubric: [{ description: ' ', score: calculation.points }] },
    { rubric: [{ description: 'Invalid score', score: Infinity }] },
  ])('retains scored rubric, reference and solution requirements %#', (overrides) => {
    const input = withCalculation(overrides)
    const errors = validateV3Publication(input)
    expect(errors).not.toEqual([])
    expect(validateV4Publication(input)).toEqual(errors)
    expect(validateV4Publication(withCalculation({ drawing: { width: 800, height: 600 }, ...overrides }))).toEqual(errors)
  })
})
