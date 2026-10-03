/* global Response, ReadableStream, TextEncoder, process, URL */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { publicSmoke } from './public-smoke.mjs'

const version = '1.3.0'
const sha = '2dfa0fdf0f97000830fa0d456105ca456f0d1df5'
const url = 'https://luketsengtw.github.io/learnforge/'
const projectUrl = 'https://mrrssxqolvcjxgqzoeqt.supabase.co'
const html = '<script type="module" src="/learnforge/assets/index.js"></script>'
const manifest = { app: 'learnforge', version, gitSha: sha }
const key = 'public-key-must-never-appear-in-output'

function fixture(overrides = {}, root = url) {
  const documents = {
    [root]: html,
    [`${root}release.json`]: JSON.stringify(manifest),
    [`${root}assets/index.js`]: `const project = "${projectUrl}"; const publicKey = "${key}";`,
    ...overrides,
  }
  const fetchImpl = vi.fn(async requestUrl => {
    const source = documents[requestUrl]
    if (source instanceof Error) throw source
    if (source instanceof Response) return source
    return new Response(source ?? 'missing', { status: source === undefined ? 404 : 200 })
  })
  return { fetchImpl, options: { url: root, version, sha, fetchImpl } }
}

describe('public release smoke', () => {
  it.each([
    'https://attacker.example/learnforge/',
    'https://luketsengtw.github.io.attacker.example/learnforge/',
    'https://luketsengtw.github.io:444/learnforge/',
    'http://luketsengtw.github.io/learnforge/',
    'https://luketsengtw.github.io/another-app/',
    'https://luketsengtw.github.io/learnforge/../learnforge/',
    'https://luketsengtw.github.io/learnforge/.',
    'https://luketsengtw.github.io/%6cearnforge/',
    'https://user:secret@luketsengtw.github.io/learnforge/',
    'http://localhost:4173/learnforge/',
    'https://localhost:4173/learnforge/',
    'http://127.0.0.1:4173/learnforge/',
  ])('rejects non-production roots by default before fetching %j', async root => {
    const { fetchImpl, options } = fixture({}, root)
    await expect(publicSmoke(options)).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    'http://localhost:4173/learnforge/',
    'https://localhost:4173/learnforge/',
    'http://127.0.0.1:4173/learnforge/',
    'http://[::1]:4173/learnforge/',
  ])('accepts explicit loopback test mode %j', async root => {
    const { fetchImpl, options } = fixture({}, root)
    await expect(publicSmoke({ ...options, allowLocal: true })).resolves.toMatchObject({
      status: 'passed', mode: 'local', origin: new URL(root).origin, pagesBasePath: '/learnforge/',
    })
    expect(fetchImpl.mock.calls.map(([requested]) => requested)).toEqual([
      root,
      `${root}release.json`,
      `${root}assets/index.js`,
    ])
  })

  it.each([
    'https://attacker.example/learnforge/',
    url,
    'http://localhost.attacker.example:4173/learnforge/',
    'http://192.168.1.2:4173/learnforge/',
    'http://127.0.0.2:4173/learnforge/',
    'http://localhost:4173/another-app/',
    'http://user:secret@localhost:4173/learnforge/',
    'ftp://localhost:4173/learnforge/',
  ])('local allowance never permits unsafe roots %j', async root => {
    const { fetchImpl, options } = fixture({}, root)
    await expect(publicSmoke({ ...options, allowLocal: true })).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not accept a truthy non-boolean as local authorization', async () => {
    const { fetchImpl, options } = fixture({}, 'http://localhost:4173/learnforge/')
    await expect(publicSmoke({ ...options, allowLocal: 'true' })).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('requires the explicit CLI local option for a real loopback static fixture', async () => {
    const requests = []
    const documents = {
      '/learnforge/': html,
      '/learnforge/release.json': JSON.stringify(manifest),
      '/learnforge/assets/index.js': `const project = "${projectUrl}";`,
    }
    const server = createServer((request, response) => {
      requests.push({ method: request.method, path: request.url })
      const source = documents[request.url]
      response.writeHead(source === undefined ? 404 : 200)
      response.end(source ?? 'missing')
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const localUrl = `http://127.0.0.1:${server.address().port}/learnforge/`
      const run = flags => new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [
          fileURLToPath(new URL('./public-smoke.mjs', import.meta.url)),
          '--url', localUrl, '--version', version, '--sha', sha, '--json', ...flags,
        ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', chunk => { stdout += chunk })
        child.stderr.on('data', chunk => { stderr += chunk })
        child.on('error', reject)
        child.on('close', code => resolve({ code, stdout, stderr }))
      })
      const rejected = await run([])
      expect(rejected.code).toBe(1)
      expect(requests).toEqual([])
      const accepted = await run(['--allow-local'])
      expect(accepted.code).toBe(0)
      expect(accepted.stderr).toBe('')
      expect(JSON.parse(accepted.stdout)).toMatchObject({
        status: 'passed', mode: 'local', origin: new URL(localUrl).origin,
        pagesBasePath: '/learnforge/', version, gitSha: sha,
      })
      expect(requests).toEqual([
        { method: 'GET', path: '/learnforge/' },
        { method: 'GET', path: '/learnforge/release.json' },
        { method: 'GET', path: '/learnforge/assets/index.js' },
      ])
    } finally {
      await new Promise(resolve => server.close(resolve))
    }
  })

  it('verifies only static public identity without leaking bundle contents', async () => {
    const { fetchImpl, options } = fixture()
    const result = await publicSmoke(options)
    expect(result).toEqual({
      status: 'passed',
      mode: 'production',
      origin: 'https://luketsengtw.github.io',
      app: 'learnforge',
      version,
      gitSha: sha,
      rootStatus: 200,
      manifestStatus: 200,
      pagesBasePath: '/learnforge/',
      supabaseProjectRef: 'mrrssxqolvcjxgqzoeqt',
      assetsChecked: 1,
    })
    expect(JSON.stringify(result)).not.toContain(key)
    expect(fetchImpl.mock.calls.map(([requested]) => requested)).toEqual([
      url,
      `${url}release.json`,
      `${url}assets/index.js`,
    ])
    for (const [, request] of fetchImpl.mock.calls) {
      expect(request.method).toBe('GET')
      expect(request.redirect).toBe('error')
      expect(request.credentials).toBe('omit')
      expect(request.signal).toBeDefined()
      expect(request.headers).not.toHaveProperty('Authorization')
    }
  })

  it('derives canonical production provenance from the validated destination', async () => {
    const { options } = fixture()
    const result = await publicSmoke({ ...options, url: 'https://LukeTsengTW.github.io:443/learnforge/' })
    expect(result).toMatchObject({ mode: 'production', origin: 'https://luketsengtw.github.io', pagesBasePath: '/learnforge/' })
  })

  it.each([
    { root: url, allowLocal: false, expectedMode: 'production' },
    { root: 'http://127.0.0.1:4173/learnforge/', allowLocal: true, expectedMode: 'local' },
  ])('ignores caller-supplied provenance for the validated $expectedMode destination', async ({ root, allowLocal, expectedMode }) => {
    const { options } = fixture({}, root)
    const result = await publicSmoke({
      ...options, allowLocal,
      mode: expectedMode === 'local' ? 'production' : 'local',
      origin: 'https://attacker.example',
      pagesBasePath: '/another-app/',
    })
    expect(result).toMatchObject({ mode: expectedMode, origin: new URL(root).origin, pagesBasePath: '/learnforge/' })
  })

  it('checks modulepreload chunks when project identity is split from the entry', async () => {
    const { options } = fixture({
      [url]: `${html}<link href="/learnforge/assets/backend.js" rel="modulepreload">`,
      [`${url}assets/index.js`]: 'console.log("app")',
      [`${url}assets/backend.js`]: `const project = "${projectUrl}";`,
    })
    await expect(publicSmoke(options)).resolves.toMatchObject({ assetsChecked: 2 })
  })

  it('checks same-origin static imports in bounded application chunks', async () => {
    const { options } = fixture({
      [`${url}assets/index.js`]: 'import { client } from "./backend.js"; export { client };',
      [`${url}assets/backend.js`]: `export const client = "${projectUrl}";`,
    })
    await expect(publicSmoke(options)).resolves.toMatchObject({ assetsChecked: 2 })
  })

  it('avoids following imports repeatedly when static chunks have a cycle', async () => {
    const { fetchImpl, options } = fixture({
      [`${url}assets/index.js`]: 'import "./backend.js";',
      [`${url}assets/backend.js`]: `import "./index.js"; const project = "${projectUrl}";`,
    })
    await expect(publicSmoke(options)).resolves.toMatchObject({ assetsChecked: 2 })
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it.each(['', '1.3', 'v1.3.0', '1.3.0-rc.1', '01.3.0'])('rejects invalid expected version %j before fetching', async badVersion => {
    const { fetchImpl, options } = fixture()
    await expect(publicSmoke({ ...options, version: badVersion })).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each(['', '2dfa0fd', sha.toUpperCase(), `${sha}0`])('rejects invalid expected SHA %j before fetching', async badSha => {
    const { fetchImpl, options } = fixture()
    await expect(publicSmoke({ ...options, sha: badSha })).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    'https://example.test/',
    'https://example.test/learnforge',
    'https://example.test/learnforge/?token=secret',
    'https://user:secret@example.test/learnforge/',
    'https://example.test/learnforge/#secret',
    'not-a-url',
  ])('rejects an unsafe or unexpected root URL %j before fetching', async badUrl => {
    const { fetchImpl, options } = fixture()
    await expect(publicSmoke({ ...options, url: badUrl })).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    { ...manifest, app: 'another-app' },
    { ...manifest, version: '1.3.1' },
    { ...manifest, gitSha: 'a'.repeat(40) },
    { ...manifest, gitSha: sha.slice(0, 8) },
    { ...manifest, publicKey: key },
    { app: 'learnforge', version },
    null,
    [],
  ])('fails closed when manifest identity does not match: %j', async identity => {
    const { options } = fixture({ [`${url}release.json`]: JSON.stringify(identity) })
    await expect(publicSmoke(options)).rejects.toThrow(/manifest/)
  })

  it('fails closed on malformed manifest JSON without printing its contents', async () => {
    const { options } = fixture({ [`${url}release.json`]: key })
    await expect(publicSmoke(options)).rejects.toThrow('Release manifest is invalid JSON')
  })

  it('fails closed when manifest keys repeat even if JSON parsing would overwrite them', async () => {
    const { options } = fixture({
      [`${url}release.json`]: `{"app":"another-app","app":"learnforge","version":"${version}","gitSha":"${sha}"}`,
    })
    await expect(publicSmoke(options)).rejects.toThrow('Release manifest contains duplicate identity fields')
  })

  it.each([201, 301, 401, 500])('requires root HTTP 200, rejecting %s', async status => {
    const { fetchImpl, options } = fixture({ [url]: new Response(key, { status }) })
    await expect(publicSmoke(options)).rejects.toThrow('Application root must return HTTP 200')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('requires manifest HTTP 200', async () => {
    const { options } = fixture({ [`${url}release.json`]: new Response(key, { status: 404 }) })
    await expect(publicSmoke(options)).rejects.toThrow('Release manifest must return HTTP 200')
  })

  it('requires every discovered application chunk to return HTTP 200', async () => {
    const { options } = fixture({ [`${url}assets/index.js`]: new Response(key, { status: 404 }) })
    await expect(publicSmoke(options)).rejects.toThrow('Application asset must return HTTP 200')
  })

  it.each([
    'https://other.test/learnforge/assets/index.js',
    '//other.test/learnforge/assets/index.js',
    '/assets/index.js',
    '/learnforge/assets/../private.js',
    '/learnforge/assets/%2e%2e/private.js',
    '/learnforge/assets/%2fprivate.js',
    '/learnforge/assets/index.js?token=secret',
    '/learnforge/assets/index.js#secret',
    '/learnforge/assets/index.css',
    'javascript:alert(1)',
    '',
  ])('rejects unsafe application asset %j before following it', async asset => {
    const { fetchImpl, options } = fixture({ [url]: `<script type="module" src="${asset}"></script>` })
    await expect(publicSmoke(options)).rejects.toThrow(/asset/)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects unsafe imported assets before making their requests', async () => {
    const { fetchImpl, options } = fixture({ [`${url}assets/index.js`]: 'import "https://provider.test/provider.js";' })
    await expect(publicSmoke(options)).rejects.toThrow(/asset/)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('requires an application module script even if HTML contains the expected project', async () => {
    const { options } = fixture({ [url]: `<meta content="${projectUrl}">` })
    await expect(publicSmoke(options)).rejects.toThrow(/module/)
  })

  it.each([
    'const project = "https://wrong-project.supabase.co";',
    `const project = "${projectUrl}.attacker.test";`,
    `const project = "${projectUrl}@attacker.test";`,
    `const project = "https://attacker.test/${projectUrl}";`,
    'const project = "mrrssxqolvcjxgqzoeqt.supabase.co";',
    'console.log("no backend configuration")',
  ])('requires the exact expected public project URL in an application bundle', async bundle => {
    const { options } = fixture({
      [url]: `<meta content="${projectUrl}">${html}`,
      [`${url}assets/index.js`]: bundle,
    })
    await expect(publicSmoke(options)).rejects.toThrow('Expected public Supabase project was not found in application assets')
  })

  it('sanitizes network errors so keys and arbitrary URL values do not leak', async () => {
    const { options } = fixture({ [url]: new Error(`Network error ${key} https://provider.test/?token=secret`) })
    await expect(publicSmoke(options)).rejects.toThrow('Application root request failed')
  })

  it('times out a request even when its fetch implementation ignores abort', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn(() => new Promise(() => {}))
      const failure = expect(publicSmoke({ url, version, sha, fetchImpl })).rejects.toThrow('Application root request timed out')
      await vi.advanceTimersByTimeAsync(10001)
      await failure
      expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('times out an incomplete streamed body', async () => {
    vi.useFakeTimers()
    try {
      const { options } = fixture({ [url]: new Response(new ReadableStream({ start() {} })) })
      const failure = expect(publicSmoke(options)).rejects.toThrow('Application root request timed out')
      await vi.advanceTimersByTimeAsync(10001)
      await failure
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not interpret import examples inside JavaScript strings as requests', async () => {
    const { fetchImpl, options } = fixture({
      [`${url}assets/index.js`]: `const example = 'import "https://provider.test/provider.js";'; const project = "${projectUrl}";`,
    })
    await expect(publicSmoke(options)).resolves.toMatchObject({ assetsChecked: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('does not execute or follow dynamic imports', async () => {
    const { fetchImpl, options } = fixture({
      [`${url}assets/index.js`]: `import("https://provider.test/provider.js"); const project = "${projectUrl}";`,
    })
    await expect(publicSmoke(options)).resolves.toMatchObject({ assetsChecked: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('rejects oversized declared bodies before reading them', async () => {
    const { options } = fixture({ [url]: new Response(key, { headers: { 'Content-Length': '100000000' } }) })
    await expect(publicSmoke(options)).rejects.toThrow('Application root exceeds the response size limit')
  })

  it('bounds streamed body sizes even when Content-Length is missing', async () => {
    const { options } = fixture({
      [url]: new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('x'.repeat(2 * 1024 * 1024)))
          controller.close()
        },
      })),
    })
    await expect(publicSmoke(options)).rejects.toThrow('Application root exceeds the response size limit')
  })

  it('caps static assets without following an unbounded graph', async () => {
    const { fetchImpl, options } = fixture({
      [url]: html + Array.from({ length: 65 }, (_, i) => `<link rel="modulepreload" href="/learnforge/assets/chunk${i}.js">`).join(''),
    })
    await expect(publicSmoke(options)).rejects.toThrow('Application asset count exceeds the limit')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
