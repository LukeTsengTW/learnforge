import { describe, expect, it, vi } from 'vitest'
import { parseSubmissionInput } from '../../../supabase/functions/_shared/semantic-fill'
import { AI_GRADING_UNAVAILABLE } from '../../../supabase/functions/submit-quiz/handler'
import { calcHandV5, calcTextV5, fixture, fullAnswers, grade, pen, submit, v1, v5Hash } from './submission-v4.test-helper'

const schema3Answers = () => ({
  ...fullAnswers(),
  q_text: calcTextV5('2x = 4 so x = 2'),
  q_hand: calcHandV5([[pen(100)], [], [pen(250)]]),
})

describe('submit-quiz schema-3 paged handwriting', () => {
  it('sends every page in saved order, finalizes with v5 provenance, and replays idempotently', async () => {
    const test = fixture(schema3Answers(), { schema: 3 })
    const response = await test.submit(submit())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ gradingVersion: 'ai-grading-v5', cached: false })
    expect(test.calculationV5.generateDrawingPages).toHaveBeenCalledTimes(1)
    const [question, pages] = vi.mocked(test.calculationV5.generateDrawingPages).mock.calls[0]
    expect(question).toMatchObject({ questionId: 'q_hand', drawing: { width: 800, height: 600 } })
    expect(pages).toHaveLength(3)
    expect(pages.every((png) => [...png.subarray(0, 8)].join(',') === '137,80,78,71,13,10,26,10')).toBe(true)
    expect(test.state.claims.filter((claim) => claim.version === 'v5')).toHaveLength(3)
    expect(test.state.finalRubric.every((row) => row.judge_version === 'ai-grading-v5')).toBe(true)
    expect(test.state.attempt).toMatchObject({ status: 'submitted', grading_version: 'ai-grading-v5', answer_schema_version: 3 })
    expect(grade(body, 'q_hand')).toMatchObject({ type: 'calculation', source: 'ai', status: 'partial' })

    const second = await test.submit(submit())
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ gradingVersion: 'ai-grading-v5', cached: true, result: body.result })
    expect(test.calculationV5.generateDrawingPages).toHaveBeenCalledTimes(1)
    expect(test.backend.v5!.claimRubric).toHaveBeenCalledTimes(3)
  })

  it('uses only active typed text and leaves retained inactive pages off the provider path', async () => {
    const answers = { ...schema3Answers(), q_hand: calcTextV5('3x = 9 so x = 3', [[pen(160)], []]) }
    const test = fixture(answers, { schema: 3 })
    expect((await test.submit(submit())).status).toBe(200)
    const handTextCall = vi.mocked(test.calculationV5.generateText).mock.calls.find(([question]) => question.questionId === 'q_hand')
    expect(handTextCall?.[1]).toBe('3x = 9 so x = 3')
    expect(test.calculationV5.generateDrawingPages).not.toHaveBeenCalled()
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
  })

  it('rejects malformed inactive page data before reserving quota or calling a provider', async () => {
    const answers = { ...schema3Answers(), q_hand: calcTextV5('x = 3', [[{ ...pen(), points: [{ x: 2000, y: 1 }] }]]) }
    const test = fixture(answers, { schema: 3 })
    const response = await test.submit(submit())
    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('invalid_answers')
    expect(test.state.claims).toEqual([])
    expect(test.calculationV5.generateText).not.toHaveBeenCalled()
    expect(test.calculationV5.generateDrawingPages).not.toHaveBeenCalled()
  })

  it('records all-blank active pages as system-unanswered without provider input', async () => {
    const answers = { ...schema3Answers(), q_hand: calcHandV5([[], []]) }
    const test = fixture(answers, { schema: 3 })
    const body = await (await test.submit(submit())).json()
    expect(grade(body, 'q_hand')).toMatchObject({ source: 'system', status: 'unanswered', score: 0 })
    expect(test.state.failures).toContain('q_hand:raster_blank')
    expect(test.calculationV5.generateDrawingPages).not.toHaveBeenCalled()
    expect(test.state.finalRubric.find((row) => row.question_id === 'q_hand'))
      .toMatchObject({ source: 'system', judge_version: 'ai-grading-v5', answer_hash: await v5Hash(answers.q_hand) })
  })

  it('does not fall back to v4 when the exact revision cannot use schema 3', async () => {
    const test = fixture(schema3Answers(), { schema: 3, revision: 'm4-r0' })
    const response = await test.submit(submit())
    expect(response.status).toBe(503)
    expect((await response.json()).error).toBe(AI_GRADING_UNAVAILABLE)
    expect(test.state.claims).toEqual([])
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(test.calculationV5.generateDrawingPages).not.toHaveBeenCalled()
  })

  it('treats the client schema selector as invalid request input', () => {
    expect(parseSubmissionInput({ requestId: '00000000-0000-4000-8000-000000000522',
      attemptId: '00000000-0000-4000-8000-000000000511', expectedUpdatedAt: v1, answerSchemaVersion: 3 })).toBeNull()
  })

  it('binds page order into the active v5 answer identity', async () => {
    const pages = [[pen(100)], [pen(250)]]
    expect(await v5Hash(calcHandV5(pages))).not.toBe(await v5Hash(calcHandV5([...pages].reverse())))
    expect(await v5Hash(calcTextV5('x = 2', [[pen(100)]]))).toBe(await v5Hash(calcTextV5('x = 2', [])))
  })
})
