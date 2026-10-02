import { describe, expect, it } from 'vitest'
import type { PracticeAnswer } from '../../models/draft-v4'
import { LocalPracticeCache } from './practice-cache'
import { SubmissionError } from './practice-repository'
import { createPracticeStore } from './practice-store'
import { fixture as edgeFixture, submit as edgeRequest } from './submission-v4.test-helper'
import { createV4MemoryRepository, memoryStorage, pen, v4Quiz } from './practice-v4.test-helper'

const handDraw = (text: string, strokes = [pen()]): PracticeAnswer =>
  ({ type: 'calculation', mode: 'drawing', text, strokes })

/**
 * Client store + in-memory draft server, with formal submission delegated to the REAL M4 submit-quiz
 * handler (fake providers, PostgreSQL-equivalent active-only v4 hash and cache semantics).
 */
function integratedEnvironment() {
  const server = createV4MemoryRepository('student')
  const edge = edgeFixture({})
  const requests: { expectedUpdatedAt: string; answers: unknown }[] = []
  server.repo.submitDraft = async (id, expectedUpdatedAt, requestId, gradingVersion) => {
    const row = server.rows.get(id)!
    // The server reads its own persisted answers and CAS; the browser sent only ids + CAS.
    edge.state.attempt.answers = Object.entries(row.record.attempt!.answers).map(([question_id, answer]) => ({ question_id, answer }))
    edge.state.attempt.updated_at = row.record.version.updatedAt
    edge.state.attempt.answer_schema_version = row.schemaVersion
    requests.push({ expectedUpdatedAt, answers: structuredClone(row.record.attempt!.answers) })
    const response = await edge.submit(edgeRequest(expectedUpdatedAt, { requestId }))
    if (response.status === 409) throw new SubmissionError('conflict')
    if (response.status === 422) throw new SubmissionError('invalid')
    if (response.status !== 200) throw new SubmissionError('unavailable')
    const body = await response.json()
    if (body.gradingVersion !== gradingVersion) throw new SubmissionError('unavailable')
    const now = new Date(Date.parse(row.record.version.updatedAt) + 1000).toISOString()
    row.record.attempt = { ...(row.record.attempt as Extract<typeof row.record.attempt, { schemaVersion: 2 }>),
      status: 'submitted', submittedAt: now, result: body.result }
    row.record.row = { ...row.record.row, status: 'submitted', grading_version: body.gradingVersion, submission_request_id: requestId,
      submitted_at: now, updated_at: now }
    row.record.version = { id, updatedAt: now }
    return { state: 'submitted', result: body.result }
  }
  return { server, edge, requests }
}

describe('M5 client -> M4 submit-quiz integration', () => {
  it('reuses the completed v4 judgment after an inactive-only edit advanced the CAS', async () => {
    const { server, edge, requests } = integratedEnvironment()
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const save = server.repo.saveDraft
    const savedVersions: string[] = []
    server.repo.saveDraft = async (...args) => { const saved = await save(...args); savedVersions.push(saved.version.updatedAt); return saved }
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    store.answer('q_hand', handDraw('first inactive note'))
    // The AI judgment completes, then finalization fails once (retryable, still a draft).
    edge.state.failFinalizeOnce = true
    expect(await store.submit()).toBeNull()
    expect(store.getSnapshot().notice).toBe('AI 評分暫時無法完成，本次作答尚未提交，請稍後再試。')
    expect(edge.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
    const firstCas = requests[0].expectedUpdatedAt

    // Only the inactive text changes: persisted through save-quiz-draft with a new CAS, shape unchanged.
    store.answer('q_hand', handDraw('edited inactive note'))
    expect(await store.submit()).toBe(initial.id)
    expect(requests).toHaveLength(2)
    expect(requests[1].expectedUpdatedAt).not.toBe(firstCas)
    expect(requests[1].expectedUpdatedAt).toBe(savedVersions.at(-1))
    expect(requests[1].answers).toMatchObject({ q_hand: handDraw('edited inactive note') })
    expect(server.v4Saves.at(-1)?.attempt.answers.q_hand).toEqual(handDraw('edited inactive note'))
    // Same active strokes -> same active-only identity -> cached judgment, no second provider call.
    expect(edge.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
    expect(edge.state.attempt).toMatchObject({ status: 'submitted', grading_version: 'ai-grading-v4' })
    expect(store.getSnapshot().attempt.status).toBe('submitted')
    store.stop()
  })

  it('an active stroke change after a failed finalization requires a new provider call', async () => {
    const { server, edge } = integratedEnvironment()
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    store.answer('q_hand', handDraw('note'))
    edge.state.failFinalizeOnce = true
    expect(await store.submit()).toBeNull()
    store.answer('q_hand', handDraw('note', [pen(), pen(260)]))
    expect(await store.submit()).toBe(initial.id)
    expect(edge.calculationV4.generateDrawing).toHaveBeenCalledTimes(2)
    store.stop()
  })
})
