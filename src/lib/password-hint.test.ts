import { describe, expect, it, vi } from 'vitest'
import { createHintHandler } from '../../supabase/functions/password-hint/handler'
const request = (body: unknown) => new Request('https://example.invalid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
describe('password-hint Edge handler', () => {
  it('rejects invalid username, arrays and bulk fields without querying the database', async () => {
    const lookup = vi.fn()
    const handler = createHintHandler({ lookup })
    for (const body of [{ username: 'x' }, { username: ['one', 'two'] }, [{ username: 'one' }], { username: 'one', all: true }]) {
      expect((await handler(request(body))).status).toBe(400)
    }
    expect(lookup).not.toHaveBeenCalled()
  })
  it('returns only the normalized requested hint, never backend fields', async () => {
    const lookup = vi.fn().mockResolvedValue({ hint: 'My clue', id: 'private', email: 'private', profile: {} })
    const response = await createHintHandler({ lookup })(request({ username: ' Student ' }))
    expect(await response.json()).toEqual({ hint: 'My clue' })
    expect(lookup).toHaveBeenCalledWith('student', expect.stringMatching(/^[a-f0-9]{64}$/))
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
  it('handles missing users and durable backend rate limits', async () => {
    const lookup = vi.fn().mockResolvedValueOnce({ hint: null }).mockResolvedValueOnce({ limited: true })
    const handler = createHintHandler({ lookup })
    expect(await (await handler(request({ username: 'missing' }))).json()).toEqual({ hint: null })
    const limited = await handler(request({ username: 'missing' }))
    expect(limited.status).toBe(429); expect(limited.headers.get('Retry-After')).toBe('900')
  })
  it('does not leak database errors and bounds request bytes', async () => {
    const handler = createHintHandler({ lookup: async () => { throw new Error('postgres internal secret') } })
    const response = await handler(request({ username: 'student' }))
    expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/postgres|secret/)
    expect((await handler(request({ username: 'x'.repeat(1100) }))).status).toBe(413)
    expect((await handler(new Request('https://example.invalid'))).status).toBe(405)
    expect((await handler(new Request('https://example.invalid', { method: 'OPTIONS' }))).status).toBe(204)
  })
})
