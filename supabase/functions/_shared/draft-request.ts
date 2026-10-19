import { draftExactKeys, draftRecord, validDraftTimestamp } from './draft-v4.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export interface SaveQuizDraftRequest {
  answerSchemaVersion?: 3
  attemptId: string
  expectedUpdatedAt: string
  clientUpdatedAt: string
  answers: Record<string, unknown>
}

/** Browser input contains changes and CAS only; identity/authority comes from the server. */
export function parseSaveQuizDraftRequest(raw: unknown): SaveQuizDraftRequest | null {
  if (!draftRecord(raw) || !(draftExactKeys(raw, ['attemptId', 'expectedUpdatedAt', 'clientUpdatedAt', 'answers'])
      || draftExactKeys(raw, ['answerSchemaVersion', 'attemptId', 'expectedUpdatedAt', 'clientUpdatedAt', 'answers']))
    || (Object.hasOwn(raw, 'answerSchemaVersion') && raw.answerSchemaVersion !== 3)
    || typeof raw.attemptId !== 'string' || !UUID.test(raw.attemptId)
    || !validDraftTimestamp(raw.expectedUpdatedAt) || !validDraftTimestamp(raw.clientUpdatedAt)
    || !draftRecord(raw.answers)) return null
  return { ...(raw.answerSchemaVersion === 3 ? { answerSchemaVersion: 3 as const } : {}),
    attemptId: raw.attemptId.toLowerCase(), expectedUpdatedAt: raw.expectedUpdatedAt,
    clientUpdatedAt: raw.clientUpdatedAt, answers: raw.answers }
}
