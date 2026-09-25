import type { AppSupabase } from '../../lib/supabase'

export type TutorFeature = 'hint' | 'explain_mistake' | 'explain_solution'
export interface TutorResponse { title: string; message: string; keyPoints: string[]; nextStep: string | null }
export interface AiQuota {
  limit: number; used: number; remaining: number; windowSeconds: number; nextCreditAt: string | null
  featureCosts: Record<TutorFeature, number>
}
export interface TutorRequest { requestId: string; feature: TutorFeature; attemptId: string; questionId: string }
export interface TutorService {
  getQuota: () => Promise<AiQuota>
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
