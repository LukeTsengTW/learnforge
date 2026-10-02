import { draftExactKeys, draftRecord, validDraftTimestamp } from './draft-v4.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export interface SaveQuizDraftRequest {
  attemptId: string
  expectedUpdatedAt: string
  clientUpdatedAt: string
  answers: Record<string, unknown>
}

/** Browser input contains changes and CAS only; identity/authority comes from the server. */
export function parseSaveQuizDraftRequest(raw: unknown): SaveQuizDraftRequest | null {
  if (!draftRecord(raw) || !draftExactKeys(raw, ['attemptId', 'expectedUpdatedAt', 'clientUpdatedAt', 'answers'])
    || typeof raw.attemptId !== 'string' || !UUID.test(raw.attemptId)
    || !validDraftTimestamp(raw.expectedUpdatedAt) || !validDraftTimestamp(raw.clientUpdatedAt)
    || !draftRecord(raw.answers)) return null
  return { attemptId: raw.attemptId.toLowerCase(), expectedUpdatedAt: raw.expectedUpdatedAt,
    clientUpdatedAt: raw.clientUpdatedAt, answers: raw.answers }
}
