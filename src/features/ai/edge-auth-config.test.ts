import { describe, expect, it } from 'vitest'
import config from '../../../supabase/config.toml?raw'
import tutorIndex from '../../../supabase/functions/ai-tutor/index.ts?raw'
import quotaIndex from '../../../supabase/functions/ai-quota/index.ts?raw'

const handlers = { 'ai-tutor': tutorIndex, 'ai-quota': quotaIndex }

function verifyJwtFor(config: string, functionName: string) {
  const match = config.match(new RegExp(`\\[functions\\.${functionName}\\]\\s*verify_jwt\\s*=\\s*(true|false)`))
  return match?.[1]
}

describe('Edge authentication configuration', () => {
  it.each(['ai-tutor', 'ai-quota'] as const)('%s delegates user JWT validation to @supabase/server', (name) => {
    expect(verifyJwtFor(config, name)).toBe('false')
    const handler = handlers[name]
    expect(handler).toMatch(/withSupabase(?:<Database>)?\(\{ auth: 'user' \}/)
    expect(handler).toContain('ctx.userClaims?.id')
    expect(handler).not.toMatch(/request\.headers\.get\(['"]Authorization['"]\)/)
  })

  it('preserves the existing password-hint platform setting', () => {
    expect(verifyJwtFor(config, 'password-hint')).toBe('false')
  })
})
