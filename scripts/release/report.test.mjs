/* global Response */
import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import { buildReport, gateNames } from './report.mjs'
import { publicSmoke } from './public-smoke.mjs'
import { releaseConfig } from './config.mjs'

const version = '1.3.0'
const gitSha = '2dfa0fdf0f97000830fa0d456105ca456f0d1df5'
const classification = { impact: 'security-ai', risk: 'C', providerCanaryRequired: false }
const sourceIdentity = { baseSha: 'b'.repeat(40), sourceFingerprint: 'f'.repeat(64) }
const identity = { version, gitSha, classification, ...sourceIdentity }
const passed = () => ({ version, gitSha, ...classification, ...sourceIdentity, gates: Object.fromEntries(gateNames.map(name => [name, { status: 'passed', exitCode: 0 }])) })
const production = (overrides = {}) => ({
  status: 'passed', mode: 'production', origin: 'https://luketsengtw.github.io',
  pagesBasePath: '/learnforge/', app: 'learnforge', version, gitSha, ...overrides,
})
const staticResponses = new Map([
  ['/learnforge/', '<script type="module" src="/learnforge/assets/app.js"></script>'],
  ['/learnforge/release.json', JSON.stringify({ app: 'learnforge', version, gitSha })],
  ['/learnforge/assets/app.js', `const project = "https://${releaseConfig.supabaseProjectRef}.supabase.co";`],
])

describe('sanitized release evidence report', () => {
  it('keeps missing gates and deployment evidence visibly incomplete', () => {
    const report = buildReport(identity)
    expect(report.status).toBe('incomplete')
    expect(report.test.status).toBe('not-run')
    expect(report.build.status).toBe('not-run')
    expect(report.deployment.status).toBe('not-supplied')
    expect(report.publicSmoke.status).toBe('not-supplied')
    expect(report.localSmoke.status).toBe('not-supplied')
  })
  it('summarizes exact-identity local checks without claiming a deployment', () => {
    const checks = passed()
    checks.gates.test.testCount = 543
    const report = buildReport({ ...identity, checks })
    expect(report.status).toBe('passed')
    expect(report.test).toEqual({ status: 'passed', exitCode: 0, testCount: 543 })
    expect(report.build.status).toBe('passed')
    expect(report.deployment.status).toBe('not-supplied')
  })
  it('records failure even when later gates are absent', () => {
    const checks = { ...passed(), gates: { lint: { status: 'failed', exitCode: 1 } } }
    expect(buildReport({ ...identity, checks }).status).toBe('failed')
  })
  it.each([
    { version: '1.2.0' }, { gitSha: 'a'.repeat(40) }, { gitSha: '2dfa0fd' },
  ])('rejects stale or malformed check identity %j', mismatch => {
    expect(() => buildReport({ ...identity, checks: { ...passed(), ...mismatch } })).toThrow(/identity|SHA/)
  })
  it('rejects a pass without successful exit evidence', () => {
    const checks = passed()
    checks.gates.test.exitCode = 1
    expect(() => buildReport({ ...identity, checks })).toThrow(/gate/)
  })
  it('rejects unknown gate statuses', () => {
    const checks = passed()
    checks.gates.build.status = 'maybe'
    expect(() => buildReport({ ...identity, checks })).toThrow(/gate/)
  })
  it('rejects cached evidence after files change at the same HEAD', () => {
    expect(() => buildReport({ ...identity, sourceFingerprint: 'e'.repeat(64), checks: passed() })).toThrow(/source/)
  })
  it('rejects evidence based on a different comparison ref', () => {
    expect(() => buildReport({ ...identity, baseSha: 'c'.repeat(40), checks: passed() })).toThrow(/base/)
  })
  it('requires cached risk and canary decisions to match current classification', () => {
    expect(() => buildReport({ ...identity, checks: { ...passed(), impact: 'docs', risk: 'A' } })).toThrow(/classification/)
    expect(() => buildReport({ ...identity, checks: { ...passed(), providerCanaryRequired: true } })).toThrow(/classification/)
  })
  it('refuses legacy checks without source identity', () => {
    const checks = passed()
    delete checks.sourceFingerprint
    expect(() => buildReport({ ...identity, checks })).toThrow(/source/)
  })
  it('accepts supplied deployment/smoke only for the report identity', () => {
    const result = { version, gitSha, status: 'passed' }
    const report = buildReport({ ...identity, checks: passed(), deployment: result, smoke: production() })
    expect(report.deployment.status).toBe('passed')
    expect(report.publicSmoke.status).toBe('passed')
    expect(() => buildReport({ ...identity, smoke: production({ gitSha: 'a'.repeat(40) }) })).toThrow(/identity/)
  })
  it('marks supplied failed production evidence as failure', () => {
    const report = buildReport({ ...identity, checks: passed(), smoke: production({ status: 'failed' }) })
    expect(report.status).toBe('failed')
    expect(report.publicSmoke.status).toBe('failed')
  })
  it('copies only allowlisted identity, statuses and counts', () => {
    const secret = 'DO_NOT_COPY_KEY_OR_USER_DATA'
    const checks = { ...passed(), credential: secret }
    checks.gates.test.stdout = secret
    const report = buildReport({ ...identity, checks, deployment: { version, gitSha, status: 'passed', users: secret } })
    expect(JSON.stringify(report)).not.toContain(secret)
  })
  it('rejects impact/risk downgrades and nonboolean canary decisions', () => {
    expect(() => buildReport({ version, gitSha, classification: { ...classification, risk: 'A' } })).toThrow(/classification/)
    expect(() => buildReport({ version, gitSha, classification: { ...classification, providerCanaryRequired: 'no' } })).toThrow(/classification/)
  })
})

describe('production smoke provenance boundary', () => {
  it('accepts actual production-mode evidence after a persisted JSON round trip', async () => {
    const evidence = await publicSmoke({
      version, sha: gitSha,
      fetchImpl: async (url, options) => {
        expect(options.method).toBe('GET')
        expect(url.startsWith(releaseConfig.productionUrl)).toBe(true)
        const pathname = url.slice('https://luketsengtw.github.io'.length)
        if (!staticResponses.has(pathname)) throw new Error('Unexpected static request')
        return new Response(staticResponses.get(pathname), { status: 200 })
      },
    })
    expect(evidence).toMatchObject(production())
    const report = buildReport({ ...identity, checks: passed(), smoke: JSON.parse(JSON.stringify(evidence)) })
    expect(report.publicSmoke).toEqual({
      status: 'passed', mode: 'production', origin: 'https://luketsengtw.github.io', pagesBasePath: '/learnforge/',
    })
    expect(report.localSmoke.status).toBe('not-supplied')
  })

  it('keeps an actual loopback smoke result local after a persisted JSON round trip', async () => {
    const requests = []
    const server = createServer((request, response) => {
      requests.push({ method: request.method, path: request.url })
      if (request.method !== 'GET' || !staticResponses.has(request.url)) {
        response.writeHead(404).end()
        return
      }
      response.writeHead(200).end(staticResponses.get(request.url))
    })
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
      const origin = `http://127.0.0.1:${server.address().port}`
      const evidence = await publicSmoke({ url: `${origin}/learnforge/`, allowLocal: true, version, sha: gitSha })
      expect(evidence).toMatchObject({ mode: 'local', origin, pagesBasePath: '/learnforge/' })
      const report = buildReport({ ...identity, checks: passed(), smoke: JSON.parse(JSON.stringify(evidence)) })
      expect(report.localSmoke).toEqual({ status: 'passed', mode: 'local', origin, pagesBasePath: '/learnforge/' })
      expect(report.publicSmoke).toEqual({ status: 'not-supplied' })
      expect(requests).toEqual([...staticResponses.keys()].map(path => ({ method: 'GET', path })))
    } finally {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  })

  it.each(['mode', 'origin', 'pagesBasePath', 'app'])('refuses production evidence missing %s', field => {
    const evidence = production()
    delete evidence[field]
    expect(() => buildReport({ ...identity, checks: passed(), smoke: evidence })).toThrow(/smoke/i)
  })

  it.each([
    { mode: 'local' }, { mode: 'unknown' },
    { origin: 'https://attacker.example' },
    { origin: 'https://luketsengtw.github.io.attacker.example' },
    { origin: 'https://luketsengtw.github.io:444' },
    { origin: 'http://luketsengtw.github.io' },
    { origin: 'https://luketsengtw.github.io/learnforge/' },
    { pagesBasePath: '/another-app/' }, { app: 'other-app' },
    { version: '1.4.0' }, { gitSha: 'a'.repeat(40) },
    { status: 'not-supplied' }, { status: undefined },
  ])('rejects inconsistent production smoke provenance: %j', mismatch => {
    expect(() => buildReport({ ...identity, checks: passed(), smoke: production(mismatch) })).toThrow()
  })

  it('does not grandfather legacy identity-only smoke into production evidence', () => {
    expect(() => buildReport({ ...identity, checks: passed(), smoke: { status: 'passed', version, gitSha } }))
      .toThrow(/smoke/i)
  })

  it.each([
    'https://attacker.example', 'http://localhost.attacker.example:4173',
    'http://user:secret@localhost:4173', 'http://localhost:4173/learnforge/',
    'http://localhost:4173?secret=value', 'ftp://localhost:4173',
  ])('rejects unsafe serialized local origin: %s', origin => {
    expect(() => buildReport({ ...identity, checks: passed(), smoke: production({ mode: 'local', origin }) }))
      .toThrow(/smoke/i)
  })

  it('keeps failed local evidence separate from production', () => {
    const report = buildReport({ ...identity, checks: passed(), smoke: production({ mode: 'local', origin: 'http://localhost:4173', status: 'failed' }) })
    expect(report.localSmoke.status).toBe('failed')
    expect(report.publicSmoke.status).toBe('not-supplied')
  })

  it('does not infer provenance from top-level report metadata or copy unknown smoke fields', () => {
    const legacy = { status: 'passed', version, gitSha }
    expect(() => buildReport({ ...identity, checks: passed(), smoke: legacy, mode: 'production', origin: production().origin }))
      .toThrow(/smoke/i)
    const sentinel = 'DO_NOT_COPY_SMOKE_HEADERS_OR_KEYS'
    const report = buildReport({ ...identity, checks: passed(), smoke: production({ headers: sentinel, publicKey: sentinel, stdout: sentinel }) })
    expect(JSON.stringify(report)).not.toContain(sentinel)
  })
})
