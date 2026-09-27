import { afterEach, expect, it, vi } from 'vitest'
import type { ConfigEnv, HtmlTagDescriptor, Plugin } from 'vite'
import config from '../vite.config'

afterEach(() => vi.unstubAllEnvs())

it('allows bundled KaTeX data fonts while retaining the production CSP boundaries', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  const userConfig = await config({ command: 'build', mode: 'production' } as ConfigEnv)
  const securityPlugin = (userConfig.plugins as Plugin[]).find(plugin => plugin.name === 'production-security-policy')
  expect(securityPlugin).toBeDefined()

  const transform = securityPlugin?.transformIndexHtml as () => HtmlTagDescriptor[]
  const tags = transform()
  const policy = tags[0].attrs?.content as string
  const directives = policy.split('; ')

  expect(directives).toContain("font-src 'self' data:")
  expect(directives).toContain("script-src 'self' https://challenges.cloudflare.com")
  expect(directives).toContain('frame-src https://challenges.cloudflare.com')
  expect(directives).toContain("connect-src 'self' https://example.supabase.co https://challenges.cloudflare.com")
  expect(directives).toContain("object-src 'none'")
  expect(directives).toContain("base-uri 'self'")
  expect(policy).not.toContain('unsafe-eval')
})
