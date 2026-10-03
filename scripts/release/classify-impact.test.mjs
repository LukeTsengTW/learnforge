import { describe, expect, it, vi } from 'vitest'
import { classifyImpact, classifyPaths, parseNameStatus } from './classify-impact.mjs'

describe('release impact classification', () => {
  it('classifies known documentation as docs without provider canaries', () => {
    expect(classifyPaths(['README.md', 'docs/ai-grading.md'])).toMatchObject({
      impact: 'docs', risk: 'A', providerCanaryRequired: false,
    })
  })

  it('distinguishes presentation UI from frontend domain behavior', () => {
    expect(classifyPaths(['src/styles/global.css']))
      .toMatchObject({ impact: 'frontend', risk: 'A' })
    expect(classifyPaths(['src/components/Button.tsx']))
      .toMatchObject({ impact: 'frontend', risk: 'B' })
    expect(classifyPaths(['src/features/quiz/use-attempts.ts']))
      .toMatchObject({ impact: 'frontend', risk: 'B' })
    expect(classifyPaths(['src/features/analytics/use-analytics.ts', 'src/content/quizzes/example.md']))
      .toMatchObject({ impact: 'frontend', risk: 'B' })
  })

  it('requires backend review for ordinary migrations and Edge functions', () => {
    expect(classifyPaths(['supabase/migrations/20261003010000_add_history.sql']))
      .toMatchObject({ impact: 'backend', risk: 'C', providerCanaryRequired: false })
    expect(classifyPaths(['supabase/functions/save-quiz-draft/handler.ts']))
      .toMatchObject({ impact: 'backend', risk: 'C', providerCanaryRequired: false })
  })

  it.each([
    'src/pages/AuthPage.tsx',
    'src/lib/password-hint.ts',
    'src/production-csp.test.ts',
    'supabase/functions/_shared/account-security.ts',
  ])('escalates Auth and security changes without requiring an unrelated provider canary: %s', (path) => {
    expect(classifyPaths([path])).toMatchObject({
      impact: 'security-ai', risk: 'C', providerCanaryRequired: false,
    })
  })

  it.each([
    'src/lib/grading.ts',
    'supabase/functions/_shared/drawing-raster.ts',
    'supabase/functions/ai-grading-v4/handler.ts',
    'supabase/functions/_shared/provider-model.ts',
    'scripts/generate-ai-quiz-context.mjs',
    'src/features/ai/request.ts',
    'src/lib/ai-request.ts',
    'supabase/functions/ai-grade/handler.ts',
    'supabase/functions/ai-responses/handler.ts',
    'supabase/functions/ai-drawing/handler.ts',
    'supabase/functions/submit-quiz/handler.ts',
  ])('requires provider-sensitive review for production behavior: %s', (path) => {
    expect(classifyPaths([path])).toMatchObject({
      impact: 'security-ai', risk: 'C', providerCanaryRequired: true,
    })
  })

  it.each([
    'src/lib/grading-v4.test.ts',
    'src/lib/provider.spec.ts',
    'src/features/ai/AiGradingControls.test.tsx',
    'src/features/quiz/submission-v4-raster.test-helper.ts',
    'supabase/functions/ai-grading-v4/tests/request.ts',
    'supabase/functions/ai-grade/test/provider.ts',
    'src/features/ai/__tests__/request.ts',
    'src/features/ai/styles.css',
    'src/features/ai/prompt-panel.scss',
    'src/features/ai/provider-icon.svg',
    'src/features/ai/docs/provider.md',
    'supabase/functions/ai-grade/README.md',
    'scripts/release/provider-check.mjs',
    '.github/workflows/provider-canary.yml',
  ])('keeps sensitive review without a provider canary for non-production behavior: %s', (path) => {
    expect(classifyPaths([path])).toMatchObject({
      impact: 'security-ai', risk: 'C', providerCanaryRequired: false,
    })
  })

  it.each([
    'supabase/functions/_shared/grading-request.ts',
    'supabase/functions/_shared/provider-request.ts',
    'supabase/functions/_shared/system-prompt.ts',
    'supabase/functions/_shared/provider-model.ts',
    'supabase/functions/_shared/drawing-raster.ts',
    'supabase/functions/_shared/answer-evidence.ts',
    'supabase/functions/_shared/provider-response-validation.ts',
    'supabase/functions/_shared/provider-cache.ts',
    'supabase/functions/_shared/ai-ledger.ts',
    'src/features/ai/contest/request.ts',
    'src/features/ai/latest/request.ts',
    'src/features/ai/testing-utils/request.ts',
    'src/features/ai/TestResults/request.ts',
    'supabase/functions/_shared/system-prompt.txt',
    'supabase/functions/_shared/system-prompt.md',
  ])('requires a canary for production request, input, response and accounting behavior: %s', (path) => {
    expect(classifyPaths([path])).toMatchObject({
      impact: 'security-ai', risk: 'C', providerCanaryRequired: true,
    })
  })

  it('normalizes Windows separators and recognizes test and presentation suffixes without case sensitivity', () => {
    expect(classifyPaths(['SRC\\FEATURES\\AI\\grading.TEST.TS', 'src\\features\\ai\\PROMPT.CSS']))
      .toMatchObject({ impact: 'security-ai', risk: 'C', providerCanaryRequired: false })
    expect(classifyPaths(['src\\features\\ai\\TestResults\\request.ts']))
      .toMatchObject({ impact: 'security-ai', risk: 'C', providerCanaryRequired: true })
  })

  it('combines non-production and production changes without losing the required canary', () => {
    expect(classifyPaths(['src/lib/grading.test.ts', 'src/features/ai/style.css', 'scripts/release/check.mjs']))
      .toMatchObject({ risk: 'C', providerCanaryRequired: false })
    expect(classifyPaths(['src/lib/grading.test.ts', 'src/features/ai/style.css', 'supabase/functions/_shared/provider-response.ts']))
      .toMatchObject({ risk: 'C', providerCanaryRequired: true })
  })

  it.each(['package.json', 'package-lock.json', '.github/workflows/deploy.yml', 'unknown/file.bin', 'src/components/settings.toml', 'src/unknown.bin', 'src/mystery/new.ts', 'src/features/mystery/new.ts', 'docs/helper.ps1'])('fails closed on an unrecognized path: %s', (path) => {
      expect(classifyPaths([path])).toMatchObject({
        impact: 'security-ai', risk: 'C', providerCanaryRequired: false,
      })
  })

  it('escalates deletions even when the deleted path is documentation', () => {
    expect(classifyPaths(['docs/old.md'], { deletedPaths: ['docs/old.md'] }))
      .toMatchObject({ impact: 'security-ai', risk: 'C' })
  })

  it('retains original and destination names for renames and copies', () => {
    expect(parseNameStatus('R100\0src/lib/grading.ts\0docs/grading.md\0C095\0old.ts\0new.ts\0'))
      .toEqual([
        { status: 'R100', paths: ['src/lib/grading.ts', 'docs/grading.md'] },
        { status: 'C095', paths: ['old.ts', 'new.ts'] },
      ])
    expect(classifyPaths(parseNameStatus('R100\0src/lib/grading.ts\0docs/grading.md\0')
      .flatMap((change) => change.paths))).toMatchObject({ impact: 'security-ai', providerCanaryRequired: true })
  })

  it('rejects malformed diff records rather than omitting paths', () => {
    expect(() => parseNameStatus('R100\0old.ts\0')).toThrow(/malformed/i)
    expect(() => parseNameStatus('M\0incomplete.ts')).toThrow(/malformed/i)
    expect(() => parseNameStatus('unexpected\0file.ts\0')).toThrow(/status/i)
  })

  it('produces deterministic, deduplicated file and reason lists', () => {
    const a = classifyPaths(['src/lib/grading.ts', 'README.md', 'src/lib/grading.ts'])
    const b = classifyPaths(['README.md', 'src/lib/grading.ts'])
    expect(a).toEqual(b)
    expect(a.files).toEqual(['README.md', 'src/lib/grading.ts'])
  })

  it('includes committed renames, staged changes, unstaged deletions and untracked files', () => {
    const sha = 'a'.repeat(40)
    const readGit = vi.fn((args) => {
      if (args[0] === 'rev-parse') return sha
      if (args[0] === 'ls-files') {
        if (args.includes('--ignored') || args.includes('--cached')) return ''
        return 'new.config\0'
      }
      if (args.includes('--cached')) return 'M\0src/styles/global.css\0'
      if (args.includes(`${sha}..${sha}`)) return 'R100\0src/lib/grading.ts\0docs/grading.md\0'
      return 'D\0docs/removed.md\0'
    })
    expect(classifyImpact({ base: 'HEAD', head: 'HEAD', includeWorkingTree: true }, { git: readGit }))
      .toMatchObject({
        impact: 'security-ai', risk: 'C', providerCanaryRequired: true,
        files: ['docs/grading.md', 'docs/removed.md', 'new.config', 'src/lib/grading.ts', 'src/styles/global.css'],
      })
    expect(readGit.mock.calls.every(([args]) => ['rev-parse', 'diff', 'ls-files'].includes(args[0]))).toBe(true)
  })

  it.each([false, true])('rejects ignored source before returning risk routing, includingWorkingTree=%s', (includeWorkingTree) => {
    const readGit = vi.fn((args) => {
      if (args[0] === 'rev-parse') return 'a'.repeat(40)
      if (args[0] === 'diff') return 'M\0README.md\0'
      if (args.includes('--ignored')) return 'src/output/payload.ts\0'
      return ''
    })
    expect(() => classifyImpact({ includeWorkingTree }, { git: readGit }))
      .toThrow(/ignored.*source|source.*ignored/i)
  })

  it('rejects a missing or option-like comparison ref', () => {
    expect(() => classifyImpact({ base: '--bad' })).toThrow(/ref/i)
    expect(() => classifyImpact({ base: '' })).toThrow(/ref/i)
  })
})
