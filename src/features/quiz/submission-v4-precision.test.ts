import { describe, expect, it, vi } from 'vitest'
import type { TutorQuestionContext } from '../../../supabase/functions/_shared/ai-tutor'
import { GRADING_ANSWER_MAX_BYTES } from '../../../supabase/functions/_shared/calculation-grading'
import { validateSubmissionRubricOutput, type SubmissionRubricOutput,
  type SubmissionRubricQuestionType } from '../../../supabase/functions/_shared/submission-rubric'
import { createTutorContextLookup } from '../../../supabase/functions/_shared/ai-tutor'
import { R0, R1, calcHand, calcText, ctx, fixture, pen, revision, submit, usage } from './submission-v4.test-helper'

const ctxHand = ctx('q_hand')

const bytes = (text: string) => new TextEncoder().encode(text).length
// 2730 three-byte characters + 2 ASCII = exactly 8192 UTF-8 bytes in only 2732 UTF-16 code units.
const exactLimit = '字'.repeat(2730) + 'ab'
const overLimit = `${exactLimit}c`

function fractional(question: TutorQuestionContext, type: SubmissionRubricQuestionType, score: number): SubmissionRubricOutput {
  const criteria = question.gradingRubric!.map((criterion, index) => ({ criterionId: criterion.id, maxScore: criterion.points,
    awardedScore: index === 0 ? 0.1 : 0.2, status: 'partial' as const, feedback: 'Partial.' }))
  return { score, maxScore: question.points!, criteria, confidence: 'medium', summary: 'Partial work.',
    ...(type === 'calculation' ? { strengths: [], improvements: [] } : { observations: [], missingOrUnclear: [] }) }
}

describe('ai-grading-v4 active text provider byte limit (pre-claim)', () => {
  it('uses the shared provider constant and measures UTF-8 bytes, not string length', () => {
    expect(GRADING_ANSWER_MAX_BYTES).toBe(8192)
    expect(bytes(exactLimit)).toBe(8192)
    expect(exactLimit.length).toBe(2732)
    expect(bytes(overLimit)).toBe(8193)
    expect(overLimit.length).toBeLessThan(8192)
  })

  it.each([['multibyte', exactLimit], ['ASCII', 'a'.repeat(8192)]])('accepts exactly 8192 %s bytes and grades it', async (_label, text) => {
    const test = fixture({ q_text: calcText(text) })
    expect((await test.submit(submit())).status).toBe(200)
    expect(test.state.claims.filter((item) => item.questionId === 'q_text')).toEqual([
      expect.objectContaining({ systemUnanswered: false })])
    expect(test.calculationV4.generateText).toHaveBeenCalledTimes(1)
    expect(test.calculationV4.generateText.mock.calls[0][1]).toBe(text)
  })

  it.each([['multibyte', overLimit], ['ASCII', 'a'.repeat(8193)]])(
    'rejects %s active text above 8192 bytes with 422 before any claim, reservation or provider call', async (_label, text) => {
    const test = fixture({ q_fill: { type: 'fill', text: 'GPU' }, q_text: calcText(text), q_hand: calcHand([pen()]) })
    const claimFill = vi.spyOn(test.backend, 'claimFill')
    const response = await test.submit(submit())
    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('invalid_answers')
    expect(test.backend.v4!.claimRubric).not.toHaveBeenCalled()
    expect(test.backend.claimRubric).not.toHaveBeenCalled()
    expect(claimFill).not.toHaveBeenCalled()
    expect(test.state.claims).toEqual([])
    expect(test.state.pending.size).toBe(0)
    expect(test.state.failures).toEqual([])
    expect(test.fillProvider.judge).not.toHaveBeenCalled()
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(test.state.attempt.status).toBe('draft')
    // The stored answer is never truncated or rewritten.
    expect(test.state.attempt.answers.find((item) => item.question_id === 'q_text')?.answer).toEqual(calcText(text))
  })

  it('does not apply the provider limit to inactive text in drawing mode', async () => {
    const inactive = '字'.repeat(4000)
    expect(bytes(inactive)).toBeGreaterThan(8192)
    const test = fixture({ q_hand: calcHand([pen()], inactive) })
    expect((await test.submit(submit())).status).toBe(200)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
  })

  it('keeps blank v4 whitespace text on the system-unanswered path regardless of its byte size', async () => {
    const blank = '　'.repeat(4000)
    expect(bytes(blank)).toBeGreaterThan(8192)
    const test = fixture({ q_text: calcText(blank) })
    const body = await (await test.submit(submit())).json()
    expect(body.result.questions.find((item: { questionId: string }) => item.questionId === 'q_text'))
      .toMatchObject({ status: 'unanswered', source: 'system' })
    expect(test.state.claims.find((item) => item.questionId === 'q_text')).toMatchObject({ systemUnanswered: true })
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
  })

  it('does not change v3: legacy oversized text still fails after its claim', async () => {
    const test = fixture({ q_text: { type: 'calculation', text: 'a'.repeat(8193) } }, { schema: 1, revision: R0 })
    test.v3CalculationProvider.generate.mockRejectedValueOnce(new Error('malformed'))
    expect((await test.submit(submit())).status).toBe(503)
    expect(test.backend.claimRubric).toHaveBeenCalled()
  })
})

describe('ai-grading-v4 one score precision contract across layers', () => {
  it.each([
    ['calculation text', 'q_text', { q_text: calcText('x = 2') }, 'generateText', 'calculation'],
    ['calculation drawing', 'q_hand', { q_hand: calcHand([pen()]) }, 'generateDrawing', 'calculation'],
    ['DrawingQuestion', 'q_draw', { q_draw: { type: 'drawing', strokes: [pen()] } }, 'drawing', 'drawing'],
  ] as const)('%s: canonical numbers reach cache, grading, finalization and replay', async (_label, id, answers, provider, type) => {
    const test = fixture(answers)
    const providerResult = async (question: TutorQuestionContext) =>
      ({ output: fractional(question, type, 0.300000004), responseId: 'fractional', usage })
    if (provider === 'drawing') test.drawingProvider.generate.mockImplementationOnce(providerResult)
    else test.calculationV4[provider].mockImplementationOnce(providerResult)
    const complete = vi.spyOn(test.backend, 'completeRubric')
    const response = await test.submit(submit())
    const body = await response.json()
    expect(response.status).toBe(200)
    const completed = complete.mock.calls.find(([, judgment]) => judgment.questionId === id)![1]
    expect(completed).toMatchObject({ score: 0.3, criteria: [{ awardedScore: 0.1 }, { awardedScore: 0.2 }] })
    expect(JSON.stringify(completed)).toContain('"score":0.3,')
    expect([...test.state.cache.values()].find((item) => item.questionId === id)?.score).toBe(0.3)
    const finalized = test.state.finalizeInputs[0].rubricJudgments.find((item) => item.questionId === id)!
    expect(finalized).toMatchObject({ score: 0.3, status: 'partial' })
    expect(body.result.questions.find((item: { questionId: string }) => item.questionId === id))
      .toMatchObject({ score: 0.3, status: 'partial' })
    expect(test.state.finalRubric.find((item) => item.question_id === id)).toMatchObject({ score: 0.3 })

    const calls = [test.calculationV4.generateText, test.calculationV4.generateDrawing, test.drawingProvider.generate]
      .map((spy) => spy.mock.calls.length)
    const replay = await (await test.submit(submit())).json()
    expect(replay).toMatchObject({ cached: true, gradingVersion: 'ai-grading-v4' })
    expect(replay.result).toEqual(body.result)
    expect([test.calculationV4.generateText, test.calculationV4.generateDrawing, test.drawingProvider.generate]
      .map((spy) => spy.mock.calls.length)).toEqual(calls)
  })

  it.each([
    ['score off the canonical total', 0.300000005, [0.1, 0.2] as const],
    // Raw scores equal the raw criterion sums, so only the post-canonicalization status check can reject them.
    ['partial that rounds to full', 2.199999999, [1.999999999, 0.2] as const],
    ['partial that rounds to none', 0.200000001, [0.000000001, 0.2] as const],
  ])('%s is rejected before completion and the attempt stays a retryable draft', async (_label, score, awards) => {
    const test = fixture({ q_hand: calcHand([pen()]) })
    const raw = fractional(ctxHand, 'calculation', score)
    raw.criteria = raw.criteria.map((criterion, index) => ({ ...criterion, awardedScore: awards[index] }))
    // Each case passes the shared (historical) tolerance validator; only the v4 contract rejects it.
    expect(validateSubmissionRubricOutput(raw, ctxHand, 'calculation')).not.toBeNull()
    test.calculationV4.generateDrawing.mockImplementationOnce(async () => ({ output: raw, responseId: 'bad', usage }))
    const complete = vi.spyOn(test.backend, 'completeRubric')
    expect((await test.submit(submit())).status).toBe(503)
    expect(complete).not.toHaveBeenCalled()
    expect(test.state.failures).toEqual(['q_hand:malformed'])
    expect(test.state.attempt.status).toBe('draft')
    expect((await test.submit(submit())).status).toBe(200)
  })

  it('refuses non-canonical persisted v4 evidence on replay instead of re-rounding it', async () => {
    const test = fixture({ q_hand: calcHand([pen()]) })
    test.calculationV4.generateDrawing.mockImplementationOnce(async (question) =>
      ({ output: fractional(question, 'calculation', 0.3), responseId: 'ok', usage }))
    expect((await test.submit(submit())).status).toBe(200)
    const row = test.state.finalRubric.find((item) => item.question_id === 'q_hand')!
    row.criteria = (row.criteria as { awardedScore: number }[]).map((criterion, index) =>
      ({ ...criterion, awardedScore: index === 1 ? 0.200000004 : criterion.awardedScore }))
    row.score = 0.300000004
    expect((await test.submit(submit())).status).toBe(503)
  })

  it('leaves v3 precision behavior unchanged (no v4 canonicalization on the v3 path)', async () => {
    const test = fixture({ q_text: { type: 'calculation', text: 'x = 2' } }, { schema: 1, revision: R0 })
    test.v3CalculationProvider.generate.mockImplementationOnce(async (question) =>
      ({ output: fractional(question, 'calculation', 0.300000005), responseId: 'v3', usage }))
    const complete = vi.spyOn(test.backend, 'completeRubric')
    await test.submit(submit())
    expect(complete.mock.calls[0][1].score).toBe(0.300000005)
  })
})

/** Exact revision R1 with one rubric question's server-owned points/rubric replaced. */
function revisionWith(questionId: string, points: number, rubric: number[]) {
  return createTutorContextLookup(revision(R1, true).map((question) => question.questionId !== questionId ? question
    : { ...question, points, gradingRubric: rubric.map((value, index) => ({ id: `r${index + 1}`, points: value,
      description: `Criterion ${index + 1}` })) }))
}

describe('M4.2 v4 server rubric context preflight', () => {
  it.each([
    ['close-but-not-equal calculation total', 'q_hand', 0.3, [0.1, 0.20000001]],
    ['non-canonical calculation criterion', 'q_text', 0.3, [0.100000001, 0.2]],
    ['non-canonical calculation points', 'q_text', 0.3000000001, [0.1, 0.2]],
    ['close-but-not-equal DrawingQuestion total', 'q_draw', 0.3, [0.1, 0.20000001]],
  ] as const)('%s is unavailable configuration with zero claims, raster or provider work', async (_label, id, points, rubric) => {
    const test = fixture({ q_fill: { type: 'fill', text: 'GPU' }, q_text: calcText('x = 2'), q_hand: calcHand([pen()]),
      q_draw: { type: 'drawing', strokes: [pen()] } }, { lookup: revisionWith(id, points, [...rubric]) })
    const claimFill = vi.spyOn(test.backend, 'claimFill')
    const response = await test.submit(submit())
    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('service_unavailable')
    expect(claimFill).not.toHaveBeenCalled()
    expect(test.backend.v4!.claimRubric).not.toHaveBeenCalled()
    expect(test.backend.claimRubric).not.toHaveBeenCalled()
    expect(test.state.claims).toEqual([])
    expect(test.state.failures).toEqual([])
    expect(test.fillProvider.judge).not.toHaveBeenCalled()
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
    expect(test.state.attempt.status).toBe('draft')
  })

  it('reports invalid server configuration ahead of a student 422, never as invalid_answers', async () => {
    const test = fixture({ q_text: calcText('a'.repeat(8193)) }, { lookup: revisionWith('q_text', 0.3, [0.1, 0.20000001]) })
    const response = await test.submit(submit())
    expect(response.status).toBe(503)
    expect((await response.json()).code).not.toBe('invalid_answers')
  })

  it('keeps an exact fractional 0.3 = 0.1 + 0.2 context gradable end to end', async () => {
    const test = fixture({ q_hand: calcHand([pen()]) }, { lookup: revisionWith('q_hand', 0.3, [0.1, 0.2]) })
    test.calculationV4.generateDrawing.mockImplementationOnce(async (question) => ({ responseId: 'full', usage,
      output: { ...fractional(question, 'calculation', 0.3),
        criteria: question.gradingRubric!.map((criterion) => ({ criterionId: criterion.id, maxScore: criterion.points,
          awardedScore: criterion.points, status: 'full' as const, feedback: 'Full.' })) } }))
    const body = await (await test.submit(submit())).json()
    expect(body.result.questions.find((item: { questionId: string }) => item.questionId === 'q_hand'))
      .toMatchObject({ status: 'correct', score: 0.3, maxScore: 0.3 })
    expect(test.state.finalizeInputs[0].questions.find((item) => item.questionId === 'q_hand'))
      .toMatchObject({ points: 0.3, rubric: [{ criterionId: 'r1', maxScore: 0.1 }, { criterionId: 'r2', maxScore: 0.2 }] })
    const replay = await (await test.submit(submit())).json()
    expect(replay).toMatchObject({ cached: true })
    expect(replay.result).toEqual(body.result)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
  })
})
