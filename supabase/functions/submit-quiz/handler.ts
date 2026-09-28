import { readBoundedJson, TutorInputError, tutorContext } from '../_shared/ai-tutor.ts'
import { AiProviderError, type ProviderUsage } from '../_shared/ai-provider.ts'
import { answerHash, FILL_JUDGE_UNAVAILABLE, gradeOfficialSubmission, normalizeStoredAnswers,
  parseFillJudgment, parseFillVerdict, parseSubmissionInput, ruleFillStatus, SEMANTIC_FILL_VERSION,
  type FillJudgment, type FillProvider, type OfficialGradeResult, type StoredAnswerRow } from '../_shared/semantic-fill.ts'

interface AttemptSnapshot {
  id: string; user_id: string; quiz_id: string; quiz_revision: string; status: string; updated_at: string
  grading_version: string; submission_request_id: string | null; answers: StoredAnswerRow[]
}
interface ClaimInput {
  userId: string; attemptId: string; expectedUpdatedAt: string; questionId: string; answerHash: string; requestId: string
}
interface ClaimResult { state: 'claimed' | 'cached' | 'in_progress' | 'conflict' | 'limited'; claimToken?: string;
  verdict?: unknown; confidence?: unknown; reason?: unknown }
export class SubmissionConflict extends Error {}
export interface SubmissionBackend {
  userId: string
  provider: FillProvider | null
  loadAttempt(attemptId: string): Promise<AttemptSnapshot | null>
  loadFinalJudgments(attemptId: string): Promise<FillJudgment[]>
  claim(input: ClaimInput): Promise<ClaimResult>
  complete(claimToken: string, verdict: 'correct' | 'incorrect', confidence: 'high' | 'medium' | 'low',
    reason: string, responseId: string | null, usage: ProviderUsage): Promise<boolean>
  fail(claimToken: string, code: string): Promise<void>
  finalize(input: { userId: string; attemptId: string; expectedUpdatedAt: string; requestId: string;
    result: OfficialGradeResult; judgments: FillJudgment[] }): Promise<boolean>
}

const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS })
const unavailable = () => json({ code: 'service_unavailable', error: FILL_JUDGE_UNAVAILABLE }, 503)
const conflict = () => json({ code: 'conflict', error: '雲端草稿已變更，作答尚未提交。請確認答案後重試。' }, 409)

export function createSubmitQuizHandler(backend: SubmissionBackend) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ code: 'method_not_allowed' }, 405)
    if (!backend.userId) return json({ code: 'unauthorized' }, 401)
    let input
    try { input = parseSubmissionInput(await readBoundedJson(request, 2048)) }
    catch (error) { return json({ code: error instanceof TutorInputError && error.kind === 'oversized'
      ? 'request_too_large' : 'invalid_request' }, error instanceof TutorInputError && error.kind === 'oversized' ? 413 : 400) }
    if (!input) return json({ code: 'invalid_request' }, 400)
    try {
      const attempt = await backend.loadAttempt(input.attemptId)
      if (!attempt || attempt.user_id !== backend.userId || attempt.id !== input.attemptId) {
        return json({ code: 'attempt_unavailable' }, 404)
      }
      if (attempt.status === 'submitted' && (attempt.grading_version !== SEMANTIC_FILL_VERSION
        || attempt.submission_request_id !== input.requestId)) return conflict()
      if (attempt.status === 'draft' && attempt.updated_at !== input.expectedUpdatedAt) return conflict()
      if (attempt.status !== 'draft' && attempt.status !== 'submitted') return conflict()
      const questions = tutorContext.listRevision(attempt.quiz_id, attempt.quiz_revision)
      if (!questions.length || questions.some((question, index) => question.questionIndex !== index
        || typeof question.points !== 'number')) return unavailable()
      const answers = normalizeStoredAnswers(questions, attempt.answers)
      if (attempt.status === 'submitted') {
        const judgments = await backend.loadFinalJudgments(attempt.id)
        const verified = await Promise.all(judgments.map(async (judgment) => {
          const text = answers[judgment.questionId]?.text
          return judgment.answerHash === await answerHash(typeof text === 'string' ? text : '')
        }))
        if (verified.some((valid) => !valid) || judgments.some((item) => !parseFillJudgment(item))) return unavailable()
        const result = gradeOfficialSubmission(questions, answers, judgments)
        return json({ attemptId: attempt.id, gradingVersion: SEMANTIC_FILL_VERSION, result, cached: true })
      }
      const judgments: FillJudgment[] = []
      for (const question of questions) {
        if (question.type !== 'fill') continue
        const text = answers[question.questionId]?.text as string | undefined
        const hash = await answerHash(text ?? '')
        const rule = ruleFillStatus(question, text)
        if (rule !== 'incorrect') {
          judgments.push({ questionId: question.questionId, answerHash: hash, source: 'rule',
            status: rule, confidence: null, reason: null })
          continue
        }
        const claim = await backend.claim({ userId: backend.userId, attemptId: attempt.id,
          expectedUpdatedAt: input.expectedUpdatedAt, questionId: question.questionId,
          answerHash: hash, requestId: input.requestId })
        if (claim.state === 'conflict') return conflict()
        if (claim.state === 'in_progress') return json({ code: 'in_progress' }, 202)
        if (claim.state === 'limited') return unavailable()
        if (claim.state === 'cached') {
          const verdict = parseFillVerdict({ verdict: claim.verdict, confidence: claim.confidence, reason: claim.reason })
          if (!verdict) return unavailable()
          judgments.push({ questionId: question.questionId, answerHash: hash, source: 'ai',
            status: verdict.verdict, confidence: verdict.confidence, reason: verdict.reason })
          continue
        }
        if (claim.state !== 'claimed' || !claim.claimToken) return unavailable()
        const token = claim.claimToken
        if (!backend.provider) {
          await backend.fail(token, 'provider_unavailable').catch(() => undefined)
          return unavailable()
        }
        try {
          const judged = await backend.provider.judge(question, text!)
          const verdict = parseFillVerdict(judged.verdict)
          if (!verdict || !await backend.complete(token, verdict.verdict, verdict.confidence,
            verdict.reason, judged.responseId, judged.usage)) throw new AiProviderError('malformed')
          judgments.push({ questionId: question.questionId, answerHash: hash, source: 'ai',
            status: verdict.verdict, confidence: verdict.confidence, reason: verdict.reason })
        } catch (failure) {
          await backend.fail(token, failure instanceof AiProviderError ? failure.code : 'server_error')
            .catch(() => undefined)
          return unavailable()
        }
      }
      const result = gradeOfficialSubmission(questions, answers, judgments)
      if (!await backend.finalize({ userId: backend.userId, attemptId: attempt.id,
        expectedUpdatedAt: input.expectedUpdatedAt, requestId: input.requestId, result, judgments })) return conflict()
      return json({ attemptId: attempt.id, gradingVersion: SEMANTIC_FILL_VERSION, result, cached: false })
    } catch (error) {
      if (error instanceof SubmissionConflict) return conflict()
      return unavailable()
    }
  }
}
