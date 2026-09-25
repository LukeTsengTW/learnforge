export interface AiQuotaBackend {
  status: () => Promise<unknown>
}
export function createQuotaHandler(backend: AiQuotaBackend) {
  return async (request: Request): Promise<Response> => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    if (request.method !== 'GET') return Response.json({ code: 'method_not_allowed', error: '不支援的要求。' }, { status: 405, headers })
    try {
      const value = await backend.status()
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid quota')
      const status = value as Record<string, unknown>
      const costs = status.featureCosts
      if (status.limit !== 20 || typeof status.used !== 'number' || typeof status.remaining !== 'number'
        || status.windowSeconds !== 18000 || typeof status.serverNow !== 'string'
        || !Number.isFinite(Date.parse(status.serverNow))
        || (status.nextCreditAt !== null && typeof status.nextCreditAt !== 'string')
        || !costs || typeof costs !== 'object' || Array.isArray(costs)) throw new Error('Invalid quota')
      const featureCosts = costs as Record<string, unknown>
      if (featureCosts.hint !== 1 || featureCosts.explain_mistake !== 1 || featureCosts.explain_solution !== 2) throw new Error('Invalid quota')
      return Response.json({ limit: status.limit, used: status.used, remaining: status.remaining,
        windowSeconds: status.windowSeconds, serverNow: status.serverNow, nextCreditAt: status.nextCreditAt,
        featureCosts: { hint: 1, explain_mistake: 1, explain_solution: 2 } }, { headers })
    } catch {
      return Response.json({ code: 'service_unavailable', error: '目前無法取得 AI 額度，請稍後再試。' }, { status: 503, headers })
    }
  }
}
