import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createAttempt } from '../../lib/attempt'
import { upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import type { AppSupabase } from '../../lib/supabase'
import type { QuizDraftV4 } from '../../models/draft-v4'
import { mapAnalyticsRecord, mapPracticeRecord, SupabasePracticeRepository, type PracticeRecord } from './practice-repository'
import type { JudgmentRow, RubricJudgmentRow } from './repositories'
import { INACTIVE_TEXT, pen, submittedV4Rows, v3Quiz, v4Catalog, v4Quiz } from './practice-v4.test-helper'

const userId = 'student'
const attemptId = '00000000-0000-4000-8000-0000000000c1'
const version = '2026-10-02T01:00:00.123456+00:00'
const savedVersion = '2026-10-02T01:00:05.654321+00:00'
const draft: QuizDraftV4 = { ...upgradeLegacyQuizDraftV4(createAttempt(v4Quiz, '2026-10-02T01:00:00.000Z'), v4Quiz)!,
  updatedAt: '2026-10-02T01:00:03.000Z', answers: { q_hand: { type: 'calculation', mode: 'drawing', text: 'inactive', strokes: [pen()] } } }

function record(schemaVersion: 1 | 2, quiz = v4Quiz): PracticeRecord {
  return { id: attemptId, schemaVersion, quiz, attempt: createAttempt(quiz, '2026-10-02T01:00:00.000Z'),
    version: { id: attemptId, updatedAt: version },
    row: { id: attemptId, user_id: userId, quiz_id: quiz.id, quiz_revision: quiz.revision, status: 'draft',
      answer_schema_version: schemaVersion } as PracticeRecord['row'] }
}
function client(invokeResult: unknown = { data: { attemptId, updatedAt: savedVersion, answerSchemaVersion: 2 }, error: null }) {
  const invoke = vi.fn(async () => invokeResult)
  const rpc = vi.fn(async () => ({ data: [{ id: attemptId, user_id: userId, quiz_revision: v3Quiz.revision, updated_at: savedVersion }], error: null }))
  return { invoke, rpc, repo: new SupabasePracticeRepository({ functions: { invoke }, rpc } as unknown as AppSupabase, userId, v4Catalog) }
}
const httpError = (status: number, body: unknown = { code: 'x' }) =>
  ({ data: null, error: new FunctionsHttpError(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) })

describe('M5 draft writers', () => {
  it('saves schema 1 only through save_quiz_attempt_v3', async () => {
    const env = client()
    const attempt = { ...createAttempt(v3Quiz, '2026-10-02T01:00:00.000Z'), updatedAt: '2026-10-02T01:00:01.000Z',
      answers: { q_hand: { type: 'calculation' as const, text: 'x=3' } } }
    await env.repo.saveDraft(record(1, v3Quiz), attempt)
    expect(env.rpc).toHaveBeenCalledWith('save_quiz_attempt_v3', expect.anything())
    expect(env.invoke).not.toHaveBeenCalled()
  })

  it('saves schema 2 only through save-quiz-draft with exactly {attemptId, expectedUpdatedAt, clientUpdatedAt, answers}', async () => {
    const env = client()
    const saved = await env.repo.saveDraft(record(1), draft)
    expect(env.rpc).not.toHaveBeenCalled()
    expect(env.invoke).toHaveBeenCalledTimes(1)
    const [name, options] = env.invoke.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }]
    expect(name).toBe('save-quiz-draft')
    expect(Object.keys(options.body).sort()).toEqual(['answers', 'attemptId', 'clientUpdatedAt', 'expectedUpdatedAt'])
    expect(options.body).toEqual({ attemptId, expectedUpdatedAt: version, clientUpdatedAt: draft.updatedAt, answers: draft.answers })
    for (const forbidden of ['userId', 'ownerId', 'quizId', 'quizRevision', 'schemaVersion', 'answerSchemaVersion',
      'gradingVersion', 'model', 'rubric', 'score', 'png', 'imageUrl']) expect(options.body).not.toHaveProperty(forbidden)
    expect(saved.version).toEqual({ id: attemptId, updatedAt: savedVersion })
  })

  it.each([
    [{ attemptId, updatedAt: savedVersion, answerSchemaVersion: 1 }],
    [{ attemptId: 'other', updatedAt: savedVersion, answerSchemaVersion: 2 }],
    [{ attemptId, updatedAt: 'not-a-time', answerSchemaVersion: 2 }],
    [{ attemptId, updatedAt: savedVersion, answerSchemaVersion: 2, gradingVersion: 'ai-grading-v4' }],
    ['plain text'],
  ])('rejects a non-strict save-quiz-draft response %#', async (data) => {
    const env = client({ data, error: null })
    await expect(env.repo.saveDraft(record(2), draft)).rejects.toMatchObject({ kind: 'invalid' })
    expect(env.rpc).not.toHaveBeenCalled()
  })

  it.each([
    [409, 'conflict'], [400, 'invalid'], [413, 'invalid'], [401, 'unavailable'], [503, 'unavailable'],
  ] as const)('maps HTTP %i to %s and never falls back to the v3 writer', async (status, kind) => {
    const env = client(httpError(status))
    await expect(env.repo.saveDraft(record(2), draft)).rejects.toMatchObject({ kind })
    expect(env.rpc).not.toHaveBeenCalled()
  })

  it('treats relay and network failures as unavailable', async () => {
    for (const error of [new FunctionsRelayError(new Response('{}', { status: 409 })), new FunctionsFetchError(new Error('offline'))]) {
      const env = client({ data: null, error })
      await expect(env.repo.saveDraft(record(2), draft)).rejects.toMatchObject({ kind: 'unavailable' })
      expect(env.rpc).not.toHaveBeenCalled()
    }
  })

  it('never writes a schema-1 attempt over a server schema-2 draft', async () => {
    const env = client()
    const attempt = { ...createAttempt(v4Quiz, '2026-10-02T01:00:00.000Z'), updatedAt: '2026-10-02T01:00:01.000Z' }
    await expect(env.repo.saveDraft(record(2), attempt)).rejects.toMatchObject({ kind: 'invalid' })
    expect(env.rpc).not.toHaveBeenCalled()
    expect(env.invoke).not.toHaveBeenCalled()
  })
})

describe('M5 formal submit response validation', () => {
  const ok = (gradingVersion: string) => ({ data: { attemptId, gradingVersion, cached: false,
    result: { score: 1, maxScore: 2, questions: [] } }, error: null })

  it('sends only requestId, attemptId and expectedUpdatedAt', async () => {
    const env = client(ok('ai-grading-v4'))
    await env.repo.submitDraft(attemptId, version, 'req-1', 'ai-grading-v4')
    const [name, options] = env.invoke.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }]
    expect(name).toBe('submit-quiz')
    expect(options.body).toEqual({ requestId: 'req-1', attemptId, expectedUpdatedAt: version })
  })

  it.each([
    ['ai-grading-v3', 'ai-grading-v3', 'submitted'], ['ai-grading-v4', 'ai-grading-v4', 'submitted'],
    ['ai-grading-v3', 'ai-grading-v4', 'unavailable'], ['ai-grading-v4', 'ai-grading-v3', 'unavailable'],
  ] as const)('expected %s with response %s -> %s', async (expected, actual, outcome) => {
    const env = client(ok(actual))
    const result = env.repo.submitDraft(attemptId, version, 'req', expected)
    if (outcome === 'submitted') expect((await result).state).toBe('submitted')
    else await expect(result).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it.each([
    [httpError(422, { code: 'invalid_answers' }), 'invalid'], [httpError(409, { code: 'conflict' }), 'conflict'],
    [httpError(503, { code: 'service_unavailable' }), 'unavailable'], [httpError(422, { code: 'other' }), 'unavailable'],
  ] as const)('maps submit errors %#', async (response, kind) => {
    const env = client(response)
    await expect(env.repo.submitDraft(attemptId, version, 'req', 'ai-grading-v4')).rejects.toMatchObject({ kind })
  })

  it('keeps in_progress as a pending state', async () => {
    const env = client({ data: { code: 'in_progress' }, error: null })
    expect(await env.repo.submitDraft(attemptId, version, 'req', 'ai-grading-v4')).toEqual({ state: 'pending' })
  })
})

describe('M5 submitted v4 reconstruction from persisted evidence', () => {
  const map = (fixture = submittedV4Rows()) => mapPracticeRecord(fixture.row as never, userId, v4Catalog,
    fixture.fill as unknown as JudgmentRow[], fixture.rubric as unknown as RubricJudgmentRow[])

  it('recomposes with gradeQuizV4, keeps both calculation buffers in the domain and requires the exact revision', () => {
    const loaded = map()
    expect(loaded.schemaVersion).toBe(2)
    expect(loaded.attempt?.status).toBe('submitted')
    if (loaded.attempt?.status !== 'submitted') throw new Error('expected submitted')
    expect(loaded.attempt.schemaVersion).toBe(2)
    expect(loaded.attempt.result).toMatchObject({ score: 5.8, maxScore: 12, partialCount: 2, correctCount: 2, incorrectCount: 1 })
    expect(loaded.attempt.answers.q_hand).toEqual({ type: 'calculation', mode: 'drawing', text: INACTIVE_TEXT, strokes: [pen()] })
    expect(loaded.attempt.result.questions.find((grade) => grade.questionId === 'q_hand'))
      .toMatchObject({ type: 'calculation', source: 'ai', score: 0.3, status: 'partial', strengths: ['Setup'] })
  })

  it.each([
    ['non-canonical v4 score', () => { const f = submittedV4Rows(); f.rubric[1].criteria[1].awardedScore = 0.200000001; f.rubric[1].score = 0.300000001; return f }],
    ['v3 judge version on a v4 attempt', () => { const f = submittedV4Rows(); f.rubric[0].judge_version = 'ai-grading-v3'; return f }],
    ['drawing feedback on handwritten calculation', () => { const f = submittedV4Rows(); f.rubric[1].details = { observations: ['x'], missingOrUnclear: [] }; return f }],
    ['aggregate mismatch', () => { const f = submittedV4Rows(); f.row.deterministic_score = 99; return f }],
    ['schema 2 with ai-grading-v3', () => submittedV4Rows(userId, undefined, { gradingVersion: 'ai-grading-v3' })],
    ['schema 1 with ai-grading-v4', () => submittedV4Rows(userId, undefined, { schema: 1 })],
    ['unknown grading version', () => submittedV4Rows(userId, undefined, { gradingVersion: 'ai-grading-v5' })],
    ['unknown schema marker', () => submittedV4Rows(userId, undefined, { schema: 3 })],
  ])('treats %s as unavailable without inventing a result', (_label, build) => {
    const fixture = build()
    if (fixture.row.answer_schema_version === 3) expect(() => map(fixture)).toThrow()
    else expect(map(fixture).attempt).toBeNull()
  })

  it('maps analytics with the full v4 answers and a legacy-safe objective projection', () => {
    const fixture = submittedV4Rows()
    const record = mapAnalyticsRecord(fixture.row as never, fixture.row.answers as never, userId, v4Catalog,
      fixture.fill as unknown as JudgmentRow[], fixture.rubric as unknown as RubricJudgmentRow[])
    expect(record.gradingVersion).toBe('ai-grading-v4')
    expect(record.answersV4?.q_hand).toMatchObject({ mode: 'drawing' })
    expect(Object.keys(record.answers ?? {}).sort()).toEqual(['q_draw', 'q_fill', 'q_single'])
    expect(record.rubricJudgments).toHaveLength(3)
  })

  it('loads fill and rubric evidence for ai-grading-v4 and none for an unknown version', async () => {
    const fixture = submittedV4Rows()
    const unknown = submittedV4Rows(userId, '00000000-0000-4000-8000-0000000000d4', { gradingVersion: 'ai-grading-v5' })
    const tables: Record<string, unknown[]> = { fill_judgments: fixture.fill, rubric_judgments: fixture.rubric }
    const queried: string[][] = []
    const builder = (table: string) => {
      const query = { select: () => query, eq: () => query,
        in: (_column: string, ids: string[]) => { queried.push([table, ...ids]); return Promise.resolve({ data: tables[table], error: null }) },
        order: () => query, range: () => Promise.resolve({ data: [fixture.row, unknown.row], error: null }) }
      return query
    }
    const repo = new SupabasePracticeRepository({ from: builder } as unknown as AppSupabase, userId, v4Catalog)
    const page = await repo.listSubmittedPage()
    expect(queried).toEqual([['fill_judgments', fixture.row.id], ['rubric_judgments', fixture.row.id]])
    expect(page.records[0].attempt?.status).toBe('submitted')
    expect(page.records[1].attempt).toBeNull()
  })
})
