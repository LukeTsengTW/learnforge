export const RECOVERY_INVALID = '復原資訊無效或已過期。'
export const PASSWORD_MIN = 8
export function validateNewPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= PASSWORD_MIN && new TextEncoder().encode(password).length <= 72
}
export function generateRecoveryCode(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return hex.match(/.{4}/g)!.join('-')
}
export function normalizeRecoveryCode(value: string): string | null {
  const code = value.trim().replaceAll('-', '').toUpperCase()
  return /^[0-9A-F]{32}$/.test(code) ? code : null
}
export async function digest(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
}
export const securityHeaders = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Expose-Headers': 'Retry-After',
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
}
export const securityJson = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...securityHeaders, ...extra } })
export async function readSecurityBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('format')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('format')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > 4096) { await reader.cancel(); throw new Error('size') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('format')
  return value as Record<string, unknown>
}
