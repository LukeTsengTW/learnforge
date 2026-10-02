import type { DraftAnswerMapV4 } from '../../../src/models/draft-v4.ts'
import { readBoundedJson, tutorContext, TutorInputError } from '../_shared/ai-tutor.ts'
import { DRAFT_V4_LIMITS, DraftValidationError, normalizeDraftAnswersV4, sameDraftTimestamp,
  validDraftTimestamp, type DraftQuestionContext } from '../_shared/draft-v4.ts'
import { parseSaveQuizDraftRequest } from '../_shared/draft-request.ts'

export interface DraftAttemptSnapshot {
  id: string
  user_id: string
  quiz_id: string
  quiz_revision: string
  status: string
  updated_at: string
  answer_schema_version: number
}
export interface DraftSaveInput {
  userId: string
  attemptId: string
  expectedUpdatedAt: string
  clientUpdatedAt: string
  answers: DraftAnswerMapV4
}
export interface DraftSaveMetadata { attemptId: string; updatedAt: string; answerSchemaVersion: 2 }
export interface DraftSaveBackend {
  userId: string | null
  loadAttempt(attemptId: string): Promise<DraftAttemptSnapshot | null>
  saveDraft(input: DraftSaveInput): Promise<DraftSaveMetadata>
}
export class DraftSaveConflict extends Error {}
interface DraftContextLookup { listRevision(quizId: string, revision: string): readonly DraftQuestionContext[] }
const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const failure = (code: 'invalid' | 'oversized' | 'conflict' | 'unauthorized' | 'unavailable', status: number) =>
  Response.json({ code, error: '無法儲存草稿，請確認作答狀態後重試。' }, { status, headers: HEADERS })

export function createSaveQuizDraftHandler(backend: DraftSaveBackend, lookup: DraftContextLookup = tutorContext) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...HEADERS, Allow: 'POST' } })
    if (!backend.userId) return failure('unauthorized', 401)
    try {
      const input = parseSaveQuizDraftRequest(await readBoundedJson(request, DRAFT_V4_LIMITS.maxRequestBytes))
      if (!input) return failure('invalid', 400)
      const attempt = await backend.loadAttempt(input.attemptId)
      // Missing and foreign attempts share the same response; no existence information escapes.
      if (!attempt || attempt.id !== input.attemptId || attempt.user_id !== backend.userId || attempt.status !== 'draft'
        || !sameDraftTimestamp(attempt.updated_at, input.expectedUpdatedAt)) return failure('conflict', 409)
      if (attempt.answer_schema_version !== 1 && attempt.answer_schema_version !== 2) return failure('unavailable', 503)
      const questions = lookup.listRevision(attempt.quiz_id, attempt.quiz_revision)
      if (!questions.length) return failure('unavailable', 503)
      const answers = normalizeDraftAnswersV4(questions, input.answers)
      const saved = await backend.saveDraft({ userId: backend.userId, attemptId: attempt.id,
        expectedUpdatedAt: input.expectedUpdatedAt, clientUpdatedAt: input.clientUpdatedAt, answers })
      if (saved.attemptId !== attempt.id || saved.answerSchemaVersion !== 2
        || !validDraftTimestamp(saved.updatedAt)) return failure('unavailable', 503)
      return Response.json({ attemptId: saved.attemptId, updatedAt: saved.updatedAt, answerSchemaVersion: 2 },
        { headers: HEADERS })
    } catch (error) {
      if (error instanceof TutorInputError || error instanceof DraftValidationError) {
        return failure(error.kind, error.kind === 'oversized' ? 413 : 400)
      }
      if (error instanceof DraftSaveConflict) return failure('conflict', 409)
      return failure('unavailable', 503)
    }
  }
}
