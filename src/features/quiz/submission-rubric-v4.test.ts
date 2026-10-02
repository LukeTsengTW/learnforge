import { describe, expect, it } from 'vitest'
import type { TutorQuestionContext } from '../../../supabase/functions/_shared/ai-tutor'
import { validateSubmissionRubricOutput, type SubmissionRubricOutput,
  type SubmissionRubricQuestionType } from '../../../supabase/functions/_shared/submission-rubric'
import { canonicalizeSubmissionRubricV4, isCanonicalSubmissionRubricContextV4,
  isCanonicalSubmissionRubricV4 } from '../../../supabase/functions/_shared/submission-rubric-v4'
import { canonicalV4Score, isCanonicalV4RubricContext, isCanonicalV4Score } from '../../lib/v4-score'

const base = { quizId: 'm41', revision: 'r1', questionIndex: 0, prompt: 'Q', hint: null, solution: 'S', rubric: [],
  referenceAnswer: 'A', points: 2, gradingRubric: [{ id: 'r1', points: 1, description: 'one' }, { id: 'r2', points: 1, description: 'two' }] }
const calc: TutorQuestionContext = { ...base, questionId: 'calc', type: 'calculation', drawing: { width: 800, height: 600 } }
const draw: TutorQuestionContext = { ...base, questionId: 'draw', type: 'drawing', drawing: { width: 400, height: 300 } }

type Status = 'full' | 'partial' | 'none'
function output(type: SubmissionRubricQuestionType, awards: [number, Status][], score?: number): SubmissionRubricOutput {
  const criteria = awards.map(([awardedScore, status], index) => ({ criterionId: `r${index + 1}`, awardedScore, maxScore: 1,
    status, feedback: 'ok' }))
  return { score: score ?? awards.reduce((sum, [award]) => sum + award, 0), maxScore: 2, criteria, confidence: 'medium',
    summary: 'Checked.', ...(type === 'calculation' ? { strengths: [], improvements: [] } : { observations: [], missingOrUnclear: [] }) }
}

describe('v4 score precision helper', () => {
  it('rounds deterministically to 8 decimals and normalizes -0', () => {
    expect(canonicalV4Score(0.1 + 0.2)).toBe(0.3)
    expect(canonicalV4Score(0.300000004)).toBe(0.3)
    // The nearest double to 0.300000005 lies just above the decimal tie, so it rounds up.
    expect(canonicalV4Score(0.300000005)).toBe(0.30000001)
    expect(canonicalV4Score(0.300000009)).toBe(0.30000001)
    expect(Object.is(canonicalV4Score(-0), 0)).toBe(true)
    expect(canonicalV4Score(Number.NaN)).toBeNull()
    expect(canonicalV4Score(Number.POSITIVE_INFINITY)).toBeNull()
    expect([0, 1, 0.1, 0.12345678, 6.3].every(isCanonicalV4Score)).toBe(true)
    expect([0.1 + 0.2, 0.123456789, 2.000000001, -0, Number.NaN].some(isCanonicalV4Score)).toBe(false)
  })
})

describe.each(['calculation', 'drawing'] as const)('v4 canonical rubric evidence (%s)', (type) => {
  const question = type === 'calculation' ? calc : draw

  it('leaves exact integer rubric output unchanged', () => {
    const raw = output(type, [[1, 'full'], [0, 'none']])
    expect(canonicalizeSubmissionRubricV4(raw, question, type)).toEqual(raw)
    expect(isCanonicalSubmissionRubricV4(raw, question, type)).toBe(true)
  })

  it('makes 0.1 + 0.2 a stable canonical 0.3 (the exact JSON used by the SQL fixture)', () => {
    const canonical = canonicalizeSubmissionRubricV4(output(type, [[0.1, 'partial'], [0.2, 'partial']]), question, type)!
    expect(canonical.score).toBe(0.3)
    expect(JSON.stringify(canonical)).toContain('"score":0.3,"maxScore":2,"criteria":[{"criterionId":"r1","awardedScore":0.1,"maxScore":1')
    expect(JSON.stringify(canonical.criteria[1])).toContain('"awardedScore":0.2')
    expect(isCanonicalSubmissionRubricV4(canonical, question, type)).toBe(true)
  })

  it('has one deterministic outcome for a provider score of 0.300000005 against a 0.3 criterion sum', () => {
    const raw = output(type, [[0.1, 'partial'], [0.2, 'partial']], 0.300000005)
    // The shared (historical) validator accepts it within its 1e-8 tolerance and keeps the raw number…
    expect(validateSubmissionRubricOutput(raw, question, type)?.score).toBe(0.300000005)
    // …but under the v4 8-decimal rule it canonicalizes to 0.30000001 != 0.3, so v4 rejects it
    // on the Edge, before any DB completion; PostgreSQL would also refuse it as non-canonical.
    expect(canonicalizeSubmissionRubricV4(raw, question, type)).toBeNull()
    expect(canonicalizeSubmissionRubricV4(raw, question, type)).toBeNull()
  })

  it('accepts a sub-tie provider score as the canonical criterion total', () => {
    const raw = output(type, [[0.1, 'partial'], [0.2, 'partial']], 0.300000004)
    const canonical = canonicalizeSubmissionRubricV4(raw, question, type)!
    expect(canonical.score).toBe(0.3)
    expect(isCanonicalSubmissionRubricV4(raw, question, type)).toBe(false)
    expect(isCanonicalSubmissionRubricV4(canonical, question, type)).toBe(true)
  })

  it('deterministically rejects a provider score outside the v4 precision', () => {
    // Within the shared 1e-8 tolerance, but canonicalizes to 0.30000001 != 0.3.
    const inside = output(type, [[0.1, 'partial'], [0.2, 'partial']], 0.300000009)
    expect(validateSubmissionRubricOutput(inside, question, type)).not.toBeNull()
    expect(canonicalizeSubmissionRubricV4(inside, question, type)).toBeNull()
    expect(canonicalizeSubmissionRubricV4(output(type, [[0.1, 'partial'], [0.2, 'partial']], 0.30000002), question, type)).toBeNull()
  })

  it('checks full/partial/none AFTER canonicalization', () => {
    expect(canonicalizeSubmissionRubricV4(output(type, [[0.999999999, 'partial'], [0, 'none']]), question, type)).toBeNull()
    expect(canonicalizeSubmissionRubricV4(output(type, [[0.000000001, 'partial'], [0, 'none']]), question, type)).toBeNull()
    expect(canonicalizeSubmissionRubricV4(output(type, [[0.999999999, 'full'], [0.000000004, 'none']]), question, type))
      .toMatchObject({ score: 1, criteria: [{ awardedScore: 1, status: 'full' }, { awardedScore: 0, status: 'none' }] })
    expect(canonicalizeSubmissionRubricV4(output(type, [[1.000000004, 'full'], [1, 'full']], 2.000000004), question, type))
      .toBeNull()
  })

  it('rejects non-canonical canonical rubric points instead of rounding server data', () => {
    const odd = { ...question, points: 1.0000000001, gradingRubric: [{ id: 'r1', points: 1.0000000001, description: 'x' }] }
    expect(canonicalizeSubmissionRubricV4({ ...output(type, [[1.0000000001, 'full']]), maxScore: 1.0000000001 }, odd, type)).toBeNull()
  })
})

describe('M4.2 v4 server rubric context invariant', () => {
  const context = (type: 'calculation' | 'drawing', points: number, rubric: number[]): TutorQuestionContext => ({
    ...(type === 'calculation' ? calc : draw), points,
    gradingRubric: rubric.map((value, index) => ({ id: `r${index + 1}`, points: value, description: `c${index + 1}` })) })

  it.each([
    ['0.3 = 0.1 + 0.2', 0.3, [0.1, 0.2], true],
    ['integer rubric', 2, [1, 1], true],
    ['close-but-not-equal 0.3 vs 0.1 + 0.20000001', 0.3, [0.1, 0.20000001], false],
    ['non-canonical criterion 0.100000001', 0.3, [0.100000001, 0.2], false],
    ['non-canonical question points', 0.3000000001, [0.1, 0.2], false],
    ['zero criterion', 0.3, [0.3, 0], false],
    ['negative criterion', 0.3, [0.4, -0.1], false],
    ['non-finite criterion', 0.3, [0.1, Number.NaN], false],
    ['empty rubric', 0.3, [], false],
  ])('%s', (_label, points, rubric, valid) => {
    expect(isCanonicalV4RubricContext(points, rubric)).toBe(valid)
    for (const type of ['calculation', 'drawing'] as const) {
      expect(isCanonicalSubmissionRubricContextV4(context(type, points, rubric))).toBe(valid)
    }
  })

  it('canonicalization refuses provider evidence for an invalid context and accepts it for the valid fractional one', () => {
    const awards = (question: TutorQuestionContext): SubmissionRubricOutput => ({ score: question.points!, maxScore: question.points!,
      criteria: question.gradingRubric!.map((criterion) => ({ criterionId: criterion.id, awardedScore: criterion.points,
        maxScore: criterion.points, status: 'full' as const, feedback: 'ok' })), confidence: 'high', summary: 'Full.',
      strengths: [], improvements: [] })
    const close = context('calculation', 0.3, [0.1, 0.20000001])
    expect(canonicalizeSubmissionRubricV4({ ...awards(close), score: 0.30000001 }, close, 'calculation')).toBeNull()
    const exact = context('calculation', 0.3, [0.1, 0.2])
    expect(canonicalizeSubmissionRubricV4(awards(exact), exact, 'calculation')).toMatchObject({ score: 0.3, maxScore: 0.3 })
    expect(isCanonicalSubmissionRubricContextV4({ ...exact, type: 'fill' })).toBe(false)
  })
})
