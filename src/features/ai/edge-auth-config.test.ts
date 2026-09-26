import { describe, expect, it } from 'vitest'
import config from '../../../supabase/config.toml?raw'
import tutorIndex from '../../../supabase/functions/ai-tutor/index.ts?raw'
import quotaIndex from '../../../supabase/functions/ai-quota/index.ts?raw'
import responsesIndex from '../../../supabase/functions/ai-responses/index.ts?raw'
import usageIndex from '../../../supabase/functions/ai-usage/index.ts?raw'
import gradeIndex from '../../../supabase/functions/ai-grade/index.ts?raw'
import drawingIndex from '../../../supabase/functions/ai-drawing/index.ts?raw'

const handlers = { 'ai-tutor': tutorIndex, 'ai-grade': gradeIndex, 'ai-drawing': drawingIndex, 'ai-quota': quotaIndex,
  'ai-responses': responsesIndex, 'ai-usage': usageIndex }

function verifyJwtFor(config: string, functionName: string) {
  const match = config.match(new RegExp(`\\[functions\\.${functionName}\\]\\s*verify_jwt\\s*=\\s*(true|false)`))
  return match?.[1]
}

describe('Edge authentication configuration', () => {
  it.each(['ai-tutor', 'ai-grade', 'ai-drawing', 'ai-quota', 'ai-responses', 'ai-usage'] as const)('%s delegates user JWT validation to @supabase/server', (name) => {
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
