import type { AppSupabase } from '../../lib/supabase'

export type TutorFeature = 'hint' | 'explain_mistake' | 'explain_solution'
export interface TutorResponse { title: string; message: string; keyPoints: string[]; nextStep: string | null }
export interface AiQuota {
  limit: number; used: number; remaining: number; windowSeconds: number; serverNow: string; nextCreditAt: string | null
  featureCosts: Record<TutorFeature, number>
}
export interface TutorRequest { requestId: string; feature: TutorFeature; attemptId: string; questionId: string }
export interface RestoredTutorResponse { questionId: string; feature: TutorFeature; response: TutorResponse; completedAt: string }
export interface TutorRestore { responses: RestoredTutorResponse[]; pending: { questionId: string; feature: TutorFeature }[] }
export interface UsageWindow {
  requestCount: number; completedCount: number; refundedCount: number; expiredCount: number
  hintCount: number; mistakeCount: number; solutionCount: number
  inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens: number
  usageReportedCount: number
}
export interface UsageCursor { createdAt: string; id: string }
export interface UsageItem { createdAt: string; quizId: string | null; quizRevision: string | null;
  questionId: string; feature: TutorFeature; credits: number; status: 'reserved' | 'completed' | 'refunded' | 'expired' }
export interface UsagePage { summary: { last5Hours: UsageWindow; last24Hours: UsageWindow; allTime: UsageWindow };
  items: UsageItem[]; nextCursor: UsageCursor | null }
export interface TutorService {
  getQuota: () => Promise<AiQuota>
  getResponses: (attemptId: string) => Promise<TutorRestore>
  getUsage: (cursor?: UsageCursor | null) => Promise<UsagePage>
  request: (input: TutorRequest) => Promise<TutorResponse>
}
export class TutorServiceError extends Error {
  readonly code: string
  readonly definitive: boolean
  constructor(code: string, definitive = false) { super(code); this.code = code; this.definitive = definitive }
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
function parseQuota(value: unknown): AiQuota {
  if (!object(value) || !object(value.featureCosts) || value.limit !== 20 || value.windowSeconds !== 18000
    || !Number.isInteger(value.used) || !Number.isInteger(value.remaining)
    || typeof value.serverNow !== 'string' || !Number.isFinite(Date.parse(value.serverNow))
    || (value.nextCreditAt !== null && typeof value.nextCreditAt !== 'string')
    || value.featureCosts.hint !== 1 || value.featureCosts.explain_mistake !== 1 || value.featureCosts.explain_solution !== 2) {
    throw new TutorServiceError('unavailable')
  }
  return value as unknown as AiQuota
}
function parseResponse(value: unknown): TutorResponse {
  if (!object(value) || typeof value.title !== 'string' || typeof value.message !== 'string'
    || !Array.isArray(value.keyPoints) || !value.keyPoints.every((item) => typeof item === 'string')
    || (value.nextStep !== null && typeof value.nextStep !== 'string')) throw new TutorServiceError('unavailable')
  return value as unknown as TutorResponse
}
const FEATURES = new Set(['hint', 'explain_mistake', 'explain_solution'])
function parseRestore(value: unknown): TutorRestore {
  if (!object(value) || !Array.isArray(value.responses) || !Array.isArray(value.pending)) throw new TutorServiceError('unavailable')
  const responses = value.responses.map((item: unknown) => {
    if (!object(item) || typeof item.questionId !== 'string' || !FEATURES.has(String(item.feature))
      || typeof item.completedAt !== 'string') throw new TutorServiceError('unavailable')
    return { questionId: item.questionId, feature: item.feature as TutorFeature,
      response: parseResponse(item.response), completedAt: item.completedAt }
  })
  const pending = value.pending.map((item: unknown) => {
    if (!object(item) || typeof item.questionId !== 'string' || !FEATURES.has(String(item.feature))) throw new TutorServiceError('unavailable')
    return { questionId: item.questionId, feature: item.feature as TutorFeature }
  })
  return { responses, pending }
}
function parseUsage(value: unknown): UsagePage {
  if (!object(value) || !object(value.summary) || !Array.isArray(value.items)
    || (value.nextCursor !== null && !object(value.nextCursor))) throw new TutorServiceError('unavailable')
  for (const window of ['last5Hours', 'last24Hours', 'allTime']) {
    const summary = value.summary[window]
    if (!object(summary) || typeof summary.requestCount !== 'number' || typeof summary.inputTokens !== 'number') {
      throw new TutorServiceError('unavailable')
    }
  }
  return value as unknown as UsagePage
}
async function invokeError(error: unknown): Promise<TutorServiceError> {
  const context = object(error) ? error.context : null
  if (context instanceof Response) {
    try {
      const body: unknown = await context.json()
      if (object(body) && typeof body.code === 'string') {
        const terminal = ['request_closed', 'quota_exhausted', 'invalid_request', 'feature_unavailable',
          'question_unavailable', 'attempt_unavailable', 'context_unavailable', 'unsupported',
          'request_too_large', 'method_not_allowed'].includes(body.code)
        return new TutorServiceError(body.code, terminal)
      }
    } catch { /* Use generic error. */ }
    return new TutorServiceError('unavailable')
  }
  return new TutorServiceError('network')
}

export class SupabaseTutorService implements TutorService {
  private readonly client: AppSupabase
  constructor(client: AppSupabase) { this.client = client }
  async getQuota(): Promise<AiQuota> {
    const { data, error } = await this.client.functions.invoke('ai-quota', {
      method: 'GET', signal: AbortSignal.timeout(20_000),
    })
    if (error) throw await invokeError(error)
    return parseQuota(data)
  }
  async getResponses(attemptId: string): Promise<TutorRestore> {
    const { data, error } = await this.client.functions.invoke(`ai-responses?attemptId=${encodeURIComponent(attemptId)}`, {
      method: 'GET', signal: AbortSignal.timeout(20_000),
    })
    if (error) throw await invokeError(error)
    return parseRestore(data)
  }
  async getUsage(cursor: UsageCursor | null = null): Promise<UsagePage> {
    const query = cursor ? `?cursorAt=${encodeURIComponent(cursor.createdAt)}&cursorId=${encodeURIComponent(cursor.id)}` : ''
    const { data, error } = await this.client.functions.invoke(`ai-usage${query}`, {
      method: 'GET', signal: AbortSignal.timeout(20_000),
    })
    if (error) throw await invokeError(error)
    return parseUsage(data)
  }
  async request(input: TutorRequest): Promise<TutorResponse> {
    const { data, error } = await this.client.functions.invoke('ai-tutor', {
      body: input, signal: AbortSignal.timeout(60_000),
    })
    if (error) throw await invokeError(error)
    if (object(data) && data.code === 'in_progress') throw new TutorServiceError('in_progress')
    if (!object(data)) throw new TutorServiceError('unavailable')
    return parseResponse(data.response)
  }
}
