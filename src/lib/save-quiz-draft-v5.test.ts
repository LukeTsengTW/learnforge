import { describe, expect, it } from 'vitest'
import { createSaveQuizDraftHandler } from '../../supabase/functions/save-quiz-draft/handler'
import type { DraftSaveInput } from '../../supabase/functions/save-quiz-draft/handler'
import type { DraftQuestionContext } from '../../supabase/functions/_shared/draft-v4'
import { v3Quiz, v4Quiz, pen } from '../features/quiz/practice-v4.test-helper'

const attemptId = '00000000-0000-4000-8000-0000000000c1'
const version = '2026-10-19T00:00:00.000Z'
const questionsFor = (quizId: string, revision: string): readonly DraftQuestionContext[] => {
  const quiz = quizId === v4Quiz.id && revision === v4Quiz.revision ? v4Quiz
    : quizId === v3Quiz.id && revision === v3Quiz.revision ? v3Quiz : null
  return quiz?.questions.map((question) => ({ questionId: question.id, type: question.type,
    ...('options' in question ? { options: question.options } : {}),
    ...('drawing' in question ? { drawing: question.drawing } : {}) })) ?? []
}
function setup(schemaMarker: number, body: Record<string, unknown>, quiz = v4Quiz) {
  let saved: DraftSaveInput | null = null
  const handler = createSaveQuizDraftHandler({ userId: 'student',
    async loadAttempt(id) { return id === attemptId ? { id, user_id: 'student', quiz_id: quiz.id,
      quiz_revision: quiz.revision, status: 'draft', updated_at: version, answer_schema_version: schemaMarker } : null },
    async saveDraft(input) {
      saved = input
      return { attemptId, updatedAt: version, answerSchemaVersion: input.answerSchemaVersion }
    },
  }, { listRevision: questionsFor })
  const request = () => handler(new Request('https://edge.test/save-quiz-draft', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  return { request, getSaved: () => saved }
}

describe('schema-3 save-quiz-draft handler', () => {
  it('validates an exact v5 calculation answer before sending a schema-3 CAS write', async () => {
    const env = setup(2, { answerSchemaVersion: 3, attemptId, expectedUpdatedAt: version, clientUpdatedAt: version,
      answers: { q_hand: { type: 'calculation', mode: 'drawing', text: 'inactive', pages: [[], [pen()]] } } })
    const response = await env.request()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ attemptId, updatedAt: version, answerSchemaVersion: 3 })
    expect(env.getSaved()).toMatchObject({ answerSchemaVersion: 3, answers: {
      q_hand: { type: 'calculation', mode: 'drawing', pages: [[], [pen()]] },
    } })
  })

  it('rejects malformed page shape before any backend save', async () => {
    const env = setup(1, { answerSchemaVersion: 3, attemptId, expectedUpdatedAt: version, clientUpdatedAt: version,
      answers: { q_hand: { type: 'calculation', mode: 'drawing', text: '', pages: Array.from({ length: 7 }, () => []) } } })
    expect((await env.request()).status).toBe(413)
    expect(env.getSaved()).toBeNull()
  })

  it('keeps the schema-2 request path and refuses v5 writes for a text-only exact revision', async () => {
    const v4 = setup(1, { attemptId, expectedUpdatedAt: version, clientUpdatedAt: version,
      answers: { q_hand: { type: 'calculation', mode: 'drawing', text: '', strokes: [pen()] } } })
    expect((await v4.request()).status).toBe(200)
    expect(v4.getSaved()?.answerSchemaVersion).toBe(2)

    const nonCapable = setup(1, { answerSchemaVersion: 3, attemptId, expectedUpdatedAt: version, clientUpdatedAt: version,
      answers: { q_hand: { type: 'calculation', mode: 'text', text: '', pages: [] } } }, v3Quiz)
    expect((await nonCapable.request()).status).toBe(503)
    expect(nonCapable.getSaved()).toBeNull()
  })
})
