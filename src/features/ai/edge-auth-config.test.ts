import { describe, expect, it } from 'vitest'
import config from '../../../supabase/config.toml?raw'
import tutorIndex from '../../../supabase/functions/ai-tutor/index.ts?raw'
import quotaIndex from '../../../supabase/functions/ai-quota/index.ts?raw'
import responsesIndex from '../../../supabase/functions/ai-responses/index.ts?raw'
import usageIndex from '../../../supabase/functions/ai-usage/index.ts?raw'
import gradeIndex from '../../../supabase/functions/ai-grade/index.ts?raw'
import drawingIndex from '../../../supabase/functions/ai-drawing/index.ts?raw'
import submitIndex from '../../../supabase/functions/submit-quiz/index.ts?raw'
import saveDraftIndex from '../../../supabase/functions/save-quiz-draft/index.ts?raw'

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

  it('keeps the pre-existing submit-quiz platform setting and handler auth', () => {
    expect(verifyJwtFor(config, 'submit-quiz')).toBe('false')
    expect(submitIndex).toMatch(/withSupabase(?:<Database>)?\(\{ auth: 'user' \}/)
    expect(submitIndex).toContain('ctx.userClaims?.id')
  })

  it('save-quiz-draft keeps platform JWT verification on and still authenticates in the handler', () => {
    expect(verifyJwtFor(config, 'save-quiz-draft')).toBe('true')
    expect(saveDraftIndex).toMatch(/withSupabase(?:<Database>)?\(\{ auth: 'user' \}/)
    expect(saveDraftIndex).toContain('ctx.userClaims?.id')
    expect(saveDraftIndex).not.toMatch(/request\.headers\.get\(['"]Authorization['"]\)/)
  })
})
