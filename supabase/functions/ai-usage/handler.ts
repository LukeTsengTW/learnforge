export interface UsagePageRow {
  id: string; created_at: string; quiz_id: string | null; quiz_revision: string | null
  question_id: string; feature: string; credits: number; status: string
}
export interface UsageCursor { createdAt: string; id: string }
export interface AiUsageBackend {
  summary: () => Promise<unknown>
  page: (cursor: UsageCursor | null) => Promise<UsagePageRow[]>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FEATURES = new Set(['hint', 'explain_mistake', 'explain_solution', 'calculation_grading'])
const STATUSES = new Set(['reserved', 'completed', 'refunded', 'expired'])
const FIELDS = ['requestCount', 'completedCount', 'refundedCount', 'expiredCount',
  'hintCount', 'mistakeCount', 'solutionCount', 'calculationGradingCount', 'inputTokens', 'cachedInputTokens',
  'outputTokens', 'reasoningTokens', 'usageReportedCount'] as const
const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }

function projectSummary(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid summary')
  const source = raw as Record<string, unknown>
  const result: Record<string, Record<string, number>> = {}
  for (const window of ['last5Hours', 'last24Hours', 'allTime']) {
    const value = source[window]
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid summary')
    const counts = value as Record<string, unknown>
    const projected: Record<string, number> = {}
    for (const field of FIELDS) {
      const count = counts[field]
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('Invalid summary')
      projected[field] = count
    }
    result[window] = projected
  }
  return result
}

export function createAiUsageHandler(backend: AiUsageBackend) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') return Response.json({ code: 'method_not_allowed' }, { status: 405, headers: HEADERS })
    const params = new URL(request.url).searchParams
    const cursorAt = params.get('cursorAt')
    const cursorId = params.get('cursorId')
    if ((cursorAt === null) !== (cursorId === null) || (cursorAt !== null &&
      (!Number.isFinite(Date.parse(cursorAt)) || !UUID.test(cursorId ?? '')))) {
      return Response.json({ code: 'invalid_request' }, { status: 400, headers: HEADERS })
    }
    try {
      const [summary, rows] = await Promise.all([
        backend.summary(), backend.page(cursorAt && cursorId ? { createdAt: cursorAt, id: cursorId } : null),
      ])
      const safeSummary = projectSummary(summary)
      if (!Array.isArray(rows) || rows.length > 21) throw new Error('Invalid page')
      const items = rows.slice(0, 20).map((row) => {
        if (!UUID.test(row.id) || !Number.isFinite(Date.parse(row.created_at))
          || !FEATURES.has(row.feature) || !STATUSES.has(row.status)
          || !Number.isInteger(row.credits) || row.credits < 1 || row.credits > 2
          || typeof row.question_id !== 'string') throw new Error('Invalid page')
        return { createdAt: row.created_at, quizId: row.quiz_id, quizRevision: row.quiz_revision,
          questionId: row.question_id, feature: row.feature, credits: row.credits, status: row.status }
      })
      const last = rows.length > 20 ? rows[19] : null
      return Response.json({ summary: safeSummary, items,
        nextCursor: last ? { createdAt: last.created_at, id: last.id } : null }, { headers: HEADERS })
    } catch {
      return Response.json({ code: 'unavailable', error: 'AI 使用紀錄暫時無法載入。' }, { status: 503, headers: HEADERS })
    }
  }
}
