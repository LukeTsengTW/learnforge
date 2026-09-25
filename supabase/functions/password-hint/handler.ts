import { normalizeUsername, validateUsername } from '../_shared/username.ts'
export interface HintBackend { lookup: (username: string, ipHash: string) => Promise<unknown> }
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers }) }
export function createHintHandler(backend: HintBackend) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return json({ error: '不支援的要求。' }, 405)
    try {
      if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: '格式錯誤。' }, 400)
      // Read at most 1 KiB, including requests without Content-Length.
      const reader = request.body?.getReader()
      if (!reader) return json({ error: '格式錯誤。' }, 400)
      let length = 0
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.length
        if (length > 1024) { await reader.cancel(); return json({ error: '要求內容過長。' }, 413) }
        chunks.push(value)
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      let input: unknown
      try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return json({ error: '格式錯誤。' }, 400) }
      if (typeof input !== 'object' || input === null || Array.isArray(input) || !('username' in input) || typeof input.username !== 'string'
        || Object.keys(input).length !== 1 || !validateUsername(input.username)) return json({ error: '使用者名稱格式錯誤。' }, 400)
      // Gateway forwarded IP is only one signal. A non-bypassable shared global quota is enforced in SQL too.
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 100) || 'unknown'
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)))).map(b => b.toString(16).padStart(2, '0')).join('')
      const result = await backend.lookup(normalizeUsername(input.username), hash)
      if (typeof result !== 'object' || result === null) throw new Error('Invalid result')
      if ('limited' in result && result.limited === true) return new Response(JSON.stringify({ error: '請求過於頻繁，請稍後再試。' }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': '900' } })
      if (!('hint' in result) || (result.hint !== null && typeof result.hint !== 'string')) throw new Error('Invalid result')
      // Explicit response projection: never forward backend fields, identifiers or errors.
      return json({ hint: result.hint })
    } catch { return json({ error: '目前無法取得密碼提示，請稍後再試。' }, 503) }
  }
}
