import { describe, expect, it, vi } from 'vitest'
import type { TutorQuestionContext } from '../../../supabase/functions/_shared/ai-tutor'
import { AiProviderError } from '../../../supabase/functions/_shared/ai-provider'
import { parseSubmissionInput } from '../../../supabase/functions/_shared/semantic-fill'
import type { SubmissionRubricOutput } from '../../../supabase/functions/_shared/submission-rubric'
import { AI_GRADING_UNAVAILABLE } from '../../../supabase/functions/submit-quiz/handler'
import { INJECTION, R0, attemptId, calcHand, calcText, ctx, eraser, fixture, fullAnswers, grade, output, pen,
  requestId, submit, usage, v1, v2, v3, v3Hash, v4Hash } from './submission-v4.test-helper'

describe('submit-quiz server dispatch', () => {
  it('routes a schema-1 draft to ai-grading-v3 with the historical calculation shape', async () => {
    const test = fixture({ q_text: { type: 'calculation', text: 'x = 2' }, q_hand: { type: 'calculation', text: 'x = 3' } },
      { schema: 1, revision: R0 })
    const response = await test.submit(submit())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.gradingVersion).toBe('ai-grading-v3')
    expect(test.backend.finalize).toHaveBeenCalledTimes(1)
    expect(test.backend.v4!.finalize).not.toHaveBeenCalled()
    expect(test.backend.v4!.claimRubric).not.toHaveBeenCalled()
    expect(test.v3CalculationProvider.generate).toHaveBeenCalledTimes(2)
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
    // Historical calculation has no drawing config; the v3 manifest never carries one.
    expect(test.state.finalizeInputs[0].questions.find((item) => item.questionId === 'q_hand')).not.toHaveProperty('drawing')
  })

  it('routes a schema-2 draft to ai-grading-v4 using v4-only claims and finalizer', async () => {
    const test = fixture(fullAnswers())
    const response = await test.submit(submit())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ gradingVersion: 'ai-grading-v4', cached: false })
    expect(test.backend.claimRubric).not.toHaveBeenCalled()
    expect(test.backend.finalize).not.toHaveBeenCalled()
    expect(test.backend.v4!.finalize).toHaveBeenCalledTimes(1)
    expect(test.state.attempt).toMatchObject({ status: 'submitted', grading_version: 'ai-grading-v4' })
    expect(test.state.finalRubric.every((item) => item.judge_version === 'ai-grading-v4')).toBe(true)
    expect(test.state.finalFill.every((item) => item.judgeVersion === 'ai-grading-v4')).toBe(true)
    expect(body.result).toMatchObject({ score: 1 + 1 + 4 + 2 + 2, maxScore: 12, manualCount: 0 })
    const manifest = test.state.finalizeInputs[0].questions
    expect(manifest.find((item) => item.questionId === 'q_hand')?.drawing).toEqual({ width: 800, height: 600 })
    expect(manifest.find((item) => item.questionId === 'q_text')).not.toHaveProperty('drawing')
  })

  it('never accepts a browser version selector or grading authority', async () => {
    for (const key of ['gradingVersion', 'answerSchemaVersion', 'quizId', 'quizRevision', 'mode', 'questionType', 'rubric',
      'model', 'reasoningEffort', 'prompt', 'referenceAnswer', 'solution', 'answerHash', 'score', 'png', 'base64', 'imageUrl']) {
      expect(parseSubmissionInput({ requestId, attemptId, expectedUpdatedAt: v1, [key]: 'forged' })).toBeNull()
    }
    const test = fixture(fullAnswers(), { schema: 1 })
    const response = await test.submit(submit(v1, { gradingVersion: 'ai-grading-v4' }))
    expect(response.status).toBe(400)
    expect(test.backend.loadAttempt).not.toHaveBeenCalled()
  })

  it('uses only the exact revision and never falls back to another revision', async () => {
    for (const revisionId of ['m4-missing', '']) {
      const test = fixture(fullAnswers(), { revision: revisionId })
      expect((await test.submit(submit())).status).toBe(503)
      expect(test.backend.v4!.claimRubric).not.toHaveBeenCalled()
      expect(test.state.attempt.status).toBe('draft')
    }
    // A schema-2 row on the historical (non-v4-capable) revision is impossible configuration: unavailable,
    // never downgraded to v3, never graded as v4, and no claims, raster or providers.
    const wrong = fixture({ q_hand: calcHand([pen()]) }, { revision: R0 })
    const response = await wrong.submit(submit())
    expect(response.status).toBe(503)
    expect(wrong.state.attempt.status).toBe('draft')
    expect(wrong.state.claims).toEqual([])
    expect(wrong.backend.claimRubric).not.toHaveBeenCalled()
    expect(wrong.backend.finalize).not.toHaveBeenCalled()
    expect(wrong.backend.v4!.finalize).not.toHaveBeenCalled()
    expect(wrong.calculationV4.generateDrawing).not.toHaveBeenCalled()
  })
})

describe('ai-grading-v4 formal revalidation', () => {
  it.each([
    ['unknown question', { unknown: calcText('x') }],
    ['legacy calculation shape', { q_text: { type: 'calculation', text: 'x = 2' } }],
    ['unknown mode', { q_hand: { ...calcHand([pen()]), mode: 'both' } }],
    ['extra authority field', { q_hand: { ...calcHand([pen()]), score: 4 } }],
    ['browser png field', { q_hand: { ...calcHand([pen()]), png: 'data:image/png;base64,AAAA' } }],
    ['wrong type', { q_hand: { type: 'drawing', strokes: [pen()] } }],
    ['invalid inactive geometry', { q_hand: calcText('x = 3', [{ ...pen(), points: [{ x: 5000, y: 1 }] }]) }],
    ['inactive extra stroke field', { q_hand: calcText('x = 3', [{ ...pen(), pressure: 1 }]) }],
    ['text-only drawing mode', { q_text: calcHand([pen()]) }],
    ['text-only inactive strokes', { q_text: calcText('x', [pen()]) }],
    ['invalid DrawingQuestion geometry', { q_draw: { type: 'drawing', strokes: [{ ...pen(), color: '#ffffff' }] } }],
  ])('keeps the draft and calls no provider for %s', async (_label, answers) => {
    const test = fixture(answers)
    const response = await test.submit(submit())
    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('invalid_answers')
    expect(test.state.attempt.status).toBe('draft')
    expect(test.backend.v4!.claimRubric).not.toHaveBeenCalled()
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
  })

  it('rejects stale CAS without grading', async () => {
    const test = fixture(fullAnswers())
    expect((await test.submit(submit(v2))).status).toBe(409)
    expect(test.backend.v4!.claimRubric).not.toHaveBeenCalled()
  })
})

describe('ai-grading-v4 calculation and drawing routing', () => {
  it('text mode uses only the calculation text provider with active text, never raster or drawing providers', async () => {
    // Drawing-capable question in text mode: the inactive strokes are retained but never rasterized or sent.
    const test = fixture({ q_hand: calcText('3x = 9 so x = 3', [pen()]) })
    expect((await test.submit(submit())).status).toBe(200)
    expect(test.calculationV4.generateText).toHaveBeenCalledExactlyOnceWith(ctx('q_hand'), '3x = 9 so x = 3')
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
    expect(test.v3CalculationProvider.generate).not.toHaveBeenCalled()
    expect(test.state.failures.filter((entry) => entry.startsWith('q_hand:'))).toEqual([])
  })

  it('drawing mode rasterizes on the server and calls only the calculation multimodal provider', async () => {
    const test = fixture({ q_hand: calcHand([pen()]) })
    const response = await test.submit(submit())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
    const [question, png] = test.calculationV4.generateDrawing.mock.calls[0]
    expect(question).toEqual(ctx('q_hand'))
    expect(question.type).toBe('calculation')
    expect(question.drawing).toEqual({ width: 800, height: 600 })
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(test.calculationV4.generateDrawing.mock.calls[0]).toHaveLength(2)
    expect(JSON.stringify(test.calculationV4.generateDrawing.mock.calls)).not.toContain(INJECTION)
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
    expect(grade(body, 'q_hand')).toMatchObject({ type: 'calculation', source: 'ai', status: 'partial', score: 2,
      strengths: ['Setup.'] })
    expect(grade(body, 'q_hand')).not.toHaveProperty('observations')
  })

  it('an actual DrawingQuestion still uses the drawing provider with v4 provenance', async () => {
    const test = fixture({ q_draw: { type: 'drawing', strokes: [pen()] } })
    const response = await test.submit(submit())
    expect(response.status).toBe(200)
    expect(test.drawingProvider.generate).toHaveBeenCalledTimes(1)
    expect(test.drawingProvider.generate.mock.calls[0][0].type).toBe('drawing')
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(test.state.finalRubric.find((item) => item.question_id === 'q_draw'))
      .toMatchObject({ question_type: 'drawing', judge_version: 'ai-grading-v4', source: 'ai' })
  })

  it.each([
    ['empty', ''], ['ASCII whitespace', ' \n\t '], ['Unicode whitespace', '　  ﻿'],
  ])('blank active text (%s) is system unanswered without a provider even with inactive strokes', async (_label, text) => {
    const test = fixture({ q_text: calcText(text), q_hand: calcText(text, [pen()]) })
    const body = await (await test.submit(submit())).json()
    expect(grade(body, 'q_text')).toMatchObject({ status: 'unanswered', source: 'system', score: 0 })
    expect(grade(body, 'q_hand')).toMatchObject({ status: 'unanswered', source: 'system', score: 0 })
    expect(test.state.claims.filter((item) => item.questionType === 'calculation').every((item) => item.systemUnanswered)).toBe(true)
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
  })

  it('blank fill uses the v4 classifier without the semantic provider', async () => {
    const test = fixture({ q_fill: { type: 'fill', text: '　' } })
    const body = await (await test.submit(submit())).json()
    expect(grade(body, 'q_fill')).toMatchObject({ status: 'unanswered' })
    expect(test.fillProvider.judge).not.toHaveBeenCalled()
  })

  it.each([
    ['no strokes', []], ['fully erased', [pen(), eraser()]], ['sub-threshold mark', [{ ...pen(), width: 1, points: [{ x: 250, y: 250 }] }]],
  ])('drawing mode %s reserves first, then server raster blankness becomes system unanswered', async (_label, strokes) => {
    const test = fixture({ q_hand: calcHand(strokes, 'nonblank inactive text') })
    const body = await (await test.submit(submit())).json()
    expect(grade(body, 'q_hand')).toMatchObject({ status: 'unanswered', source: 'system', score: 0, maxScore: 4 })
    expect(test.state.claims.find((item) => item.questionId === 'q_hand')).toMatchObject({ systemUnanswered: false })
    expect(test.state.failures).toContain('q_hand:raster_blank')
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(test.calculationV4.generateText).not.toHaveBeenCalled()
    expect(test.state.finalRubric.find((item) => item.question_id === 'q_hand'))
      .toMatchObject({ source: 'system', answer_hash: await v4Hash(calcHand(strokes, 'nonblank inactive text')) })
  })

  it('a meaningful drawing never relies on stroke count and is AI graded', async () => {
    const test = fixture({ q_hand: calcHand([pen(100), pen(200), eraser(100)]) })
    expect((await test.submit(submit())).status).toBe(200)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
  })

  it('stops at in_progress before any raster or provider work', async () => {
    const test = fixture({ q_hand: calcHand([pen()]) })
    const claimSpy = vi.mocked(test.backend.v4!.claimRubric)
    const original = claimSpy.getMockImplementation()!
    claimSpy.mockImplementation(async (input) => input.questionId === 'q_hand' ? { state: 'in_progress' } : original(input))
    expect((await test.submit(submit())).status).toBe(202)
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(test.state.failures).toEqual([])
  })
})

describe('ai-grading-v4 failures and retry', () => {
  it.each([
    ['timeout', () => { throw new AiProviderError('timeout') }],
    ['refusal', () => { throw new AiProviderError('malformed') }],
    ['malformed output', async (question: TutorQuestionContext) => ({ output: { ...output(question, 'calculation'), score: 99 }, responseId: 'x', usage })],
    ['drawing-only fields', async (question: TutorQuestionContext) => ({ output: { ...output(question, 'calculation'),
      observations: [] } as SubmissionRubricOutput, responseId: 'x', usage })],
  ])('handwritten provider %s leaves the attempt draft without zero evidence', async (_label, failure) => {
    const test = fixture({ q_hand: calcHand([pen()]) })
    test.calculationV4.generateDrawing.mockImplementationOnce(failure as never)
    const response = await test.submit(submit())
    expect(response.status).toBe(503)
    expect((await response.json()).error).toBe(AI_GRADING_UNAVAILABLE)
    expect(test.state.attempt.status).toBe('draft')
    expect(test.state.finalRubric).toEqual([])
    expect(test.backend.v4!.finalize).not.toHaveBeenCalled()
    expect(test.state.pending.size).toBe(0)
  })

  it('text provider failure and missing provider also stay retryable', async () => {
    const test = fixture({ q_text: calcText('x = 2') })
    test.calculationV4.generateText.mockRejectedValueOnce(new AiProviderError('provider_unavailable'))
    expect((await test.submit(submit())).status).toBe(503)
    expect(test.state.attempt.status).toBe('draft')
    test.backend.v4!.calculationProvider = null
    expect((await test.submit(submit())).status).toBe(503)
    expect(test.state.failures).toEqual(['q_text:provider_unavailable', 'q_text:provider_unavailable'])
  })

  it('reuses the completed v4 judgment after only the inactive text changed and CAS advanced', async () => {
    const test = fixture({ q_hand: calcHand([pen()], 'first note') })
    test.state.failFinalizeOnce = true
    expect((await test.submit(submit())).status).toBe(503)
    expect(test.state.attempt.status).toBe('draft')
    test.saveDraft({ q_hand: calcHand([pen()], 'edited inactive note') }, v2)
    const response = await test.submit(submit(v2))
    expect(response.status).toBe(200)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['active stroke change', calcHand([pen()]), calcHand([pen(200)]), 'generateDrawing'],
    ['active text change', calcText('x = 3', [pen()]), calcText('x = 3 checked', [pen()]), 'generateText'],
    ['mode switch to text', calcHand([pen()], 'x = 3'), calcText('x = 3', [pen()]), 'generateText'],
    ['mode switch to drawing', calcText('x = 3', [pen()]), calcHand([pen()], 'x = 3'), 'generateDrawing'],
  ] as const)('%s needs a new claim and provider call', async (_label, first, second, method) => {
    const test = fixture({ q_hand: first })
    test.state.failFinalizeOnce = true
    expect((await test.submit(submit())).status).toBe(503)
    const calls = test.calculationV4.generateText.mock.calls.length + test.calculationV4.generateDrawing.mock.calls.length
    test.saveDraft({ q_hand: second }, v2)
    expect((await test.submit(submit(v2))).status).toBe(200)
    expect(test.calculationV4[method].mock.calls.length
      + test.calculationV4[method === 'generateText' ? 'generateDrawing' : 'generateText'].mock.calls.length).toBe(calls + 1)
    expect(test.calculationV4[method]).toHaveBeenCalled()
    expect(await v4Hash(first)).not.toBe(await v4Hash(second))
  })

  it('inactive-only edits keep the PostgreSQL-equivalent active identity in both modes', async () => {
    expect(await v4Hash(calcText('x', [pen()]))).toBe(await v4Hash(calcText('x', [pen(200), pen(50)])))
    expect(await v4Hash(calcHand([pen()], 'a'))).toBe(await v4Hash(calcHand([pen()], 'b')))
    expect(await v4Hash(calcText('x'))).not.toBe(await v3Hash(calcText('x')))
  })
})

describe('submitted reconstruction', () => {
  it('replays submitted v4 from persisted evidence and PostgreSQL identities without any provider call', async () => {
    const test = fixture(fullAnswers())
    const first = await (await test.submit(submit())).json()
    const calls = [test.calculationV4.generateText, test.calculationV4.generateDrawing, test.drawingProvider.generate,
      test.fillProvider.judge].map((spy) => spy.mock.calls.length)
    const replay = await test.submit(submit())
    const body = await replay.json()
    expect(replay.status).toBe(200)
    expect(body).toMatchObject({ gradingVersion: 'ai-grading-v4', cached: true })
    expect(body.result).toEqual(first.result)
    expect([test.calculationV4.generateText, test.calculationV4.generateDrawing, test.drawingProvider.generate,
      test.fillProvider.judge].map((spy) => spy.mock.calls.length)).toEqual(calls)
    expect(test.backend.v4!.loadAnswerHashes).toHaveBeenCalled()
    expect(test.backend.v4!.claimRubric).toHaveBeenCalledTimes(3)
  })

  it('rejects v4 evidence whose hash does not match the v4 active identity or the stored aggregate', async () => {
    const tampered = fixture(fullAnswers())
    await tampered.submit(submit())
    tampered.state.finalRubric[0].answer_hash = await v3Hash(tampered.state.attempt.answers.find((item) =>
      item.question_id === tampered.state.finalRubric[0].question_id)!.answer)
    expect((await tampered.submit(submit())).status).toBe(503)
    const aggregate = fixture(fullAnswers())
    await aggregate.submit(submit())
    aggregate.state.attempt.deterministic_score = 0
    expect((await aggregate.submit(submit())).status).toBe(503)
    const version = fixture(fullAnswers())
    await version.submit(submit())
    version.state.finalRubric = version.state.finalRubric.map((item) => ({ ...item, judge_version: 'ai-grading-v3' }))
    expect((await version.submit(submit())).status).toBe(503)
  })

  it('keeps historical v3 reconstruction and version-consistent request replay', async () => {
    const test = fixture({ q_text: { type: 'calculation', text: 'x = 2' } }, { schema: 1, revision: R0 })
    await test.submit(submit())
    const replay = await test.submit(submit())
    expect(await replay.json()).toMatchObject({ gradingVersion: 'ai-grading-v3', cached: true })
    expect(test.backend.v4!.loadAnswerHashes).not.toHaveBeenCalled()
    expect((await test.submit(submit(v1, { requestId: crypto.randomUUID() }))).status).toBe(409)
    // A v3 row is never interpreted with v4 semantics, nor a v4 row as v3.
    test.state.attempt.answer_schema_version = 2
    expect((await test.submit(submit())).status).toBe(503)
    const v4 = fixture(fullAnswers())
    await v4.submit(submit())
    expect((await v4.submit(submit(v1, { requestId: crypto.randomUUID() }))).status).toBe(409)
    v4.state.attempt.grading_version = 'ai-grading-v3'
    expect((await v4.submit(submit())).status).toBe(503)
  })
})

describe('v4 backend wiring is required for schema 2', () => {
  it('never downgrades a schema-2 draft to v3 when the v4 backend is missing', async () => {
    const test = fixture(fullAnswers())
    delete test.backend.v4
    expect((await test.submit(submit())).status).toBe(503)
    expect(test.backend.claimRubric).not.toHaveBeenCalled()
    expect(test.backend.finalize).not.toHaveBeenCalled()
    expect(test.state.attempt.status).toBe('draft')
  })

  it('keeps v3 grading for schema 1 untouched by v4 blank semantics', async () => {
    const test = fixture({ q_text: { type: 'calculation', text: '　' } }, { schema: 1, revision: R0 })
    const body = await (await test.submit(submit())).json()
    expect(grade(body, 'q_text')).toMatchObject({ status: 'unanswered', source: 'system' })
    expect(test.v3CalculationProvider.generate).not.toHaveBeenCalled()
    expect(v3).toBe('2026-10-02T00:00:02.000Z')
  })
})
