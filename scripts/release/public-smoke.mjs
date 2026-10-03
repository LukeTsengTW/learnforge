/* global AbortController, clearTimeout, console, fetch, process, setTimeout, TextDecoder, URL */
import { releaseConfig } from './config.mjs'
import { isMain, parseArgs, runCli, validateSha, validateVersion } from './common.mjs'

const limits = Object.freeze({ rootBytes: 1024 * 1024, manifestBytes: 4096, assetBytes: 4 * 1024 * 1024, totalAssetBytes: 16 * 1024 * 1024, assets: 64, timeoutMs: 10000 })

class SmokeError extends Error {}

function rootUrl(value, allowLocal) {
  let result
  try {
    if (typeof value !== 'string' || value.length > 2048 || !/^https?:\/\//i.test(value) || /[\s\\%]/.test(value) || /\/(?:\.|\.\.)(?:\/|$)/.test(value)) throw new Error()
    result = new URL(value)
  } catch {
    throw new SmokeError('Application root URL is invalid')
  }
  if (typeof allowLocal !== 'boolean') throw new SmokeError('Local smoke allowance must be explicitly boolean')
  if (result.username || result.password || result.search || result.hash || result.pathname !== releaseConfig.pagesBasePath) {
    throw new SmokeError('Application root URL must use the expected Pages base path without credentials, query, or fragment')
  }
  if (allowLocal) {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(result.hostname) || !['http:', 'https:'].includes(result.protocol)) {
      throw new SmokeError('Local smoke mode requires a loopback HTTP or HTTPS application root')
    }
  } else if (result.origin !== new URL(releaseConfig.productionUrl).origin) {
    throw new SmokeError('Application root URL must match the configured production origin')
  }
  return result
}

function assetUrl(value, parent, root) {
  let result
  try {
    // Vite assets have literal paths. Refuse encoded or ambiguous path syntax
    // before URL normalization can conceal a traversal or change its meaning.
    if (!value || value.length > 2048 || /[\s\\%?#&]/.test(value)) throw new Error()
    const pathPart = value.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/]+/, '').replace(/^\.\//, '')
    if (pathPart.split('/').some(segment => segment === '.' || segment === '..')) throw new Error()
    result = new URL(value, parent)
  } catch {
    throw new SmokeError('Application asset URL is invalid')
  }
  const prefix = `${releaseConfig.pagesBasePath}assets/`
  const suffix = result.pathname.slice(prefix.length)
  if (result.origin !== root.origin || result.username || result.password || result.search || result.hash || !result.pathname.startsWith(prefix) || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:m?js)$/.test(suffix)) {
    throw new SmokeError('Application asset must be same-origin JavaScript within the expected Pages assets path')
  }
  return result.href
}

async function requestText(url, label, maxBytes, fetchImpl) {
  const controller = new AbortController()
  let timer
  let reader
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new SmokeError(`${label} request timed out`))
    }, limits.timeoutMs)
  })
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', credentials: 'omit', signal: controller.signal, headers: { Accept: '*/*' } })
      if (response.status !== 200) throw new SmokeError(`${label} must return HTTP 200`)
      const length = response.headers.get('content-length')
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new SmokeError(`${label} exceeds the response size limit`)
      if (!response.body || typeof response.body.getReader !== 'function') throw new SmokeError(`${label} response body is unavailable`)
      reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      let bytes = 0
      const parts = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > maxBytes) throw new SmokeError(`${label} exceeds the response size limit`)
        parts.push(decoder.decode(value, { stream: true }))
      }
      parts.push(decoder.decode())
      return { text: parts.join(''), bytes }
    })()])
  } catch (error) {
    if (error instanceof SmokeError) throw error
    throw new SmokeError(`${label} request failed`)
  } finally {
    clearTimeout(timer)
    controller.abort()
    if (reader) void reader.cancel().catch(() => {})
  }
}

function attributes(source) {
  const result = new Map()
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  for (const match of source.matchAll(pattern)) {
    const name = match[1].toLowerCase()
    if (result.has(name)) throw new SmokeError('Application asset markup contains duplicate attributes')
    result.set(name, match[2] ?? match[3] ?? match[4] ?? '')
  }
  return result
}

function linkedAssets(html) {
  const references = []
  let hasModule = false
  // Only inspect linked static files. No browser, script execution, route
  // navigation, authentication, CAPTCHA, or Supabase/provider requests occur.
  for (const match of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
    const attrs = attributes(match[2])
    if (match[1].toLowerCase() === 'script' && attrs.has('src')) {
      if (attrs.get('type')?.toLowerCase() === 'module') hasModule = true
      references.push(attrs.get('src'))
    } else if (match[1].toLowerCase() === 'link' && attrs.get('rel')?.toLowerCase().split(/\s+/).includes('modulepreload')) {
      if (!attrs.has('href')) throw new SmokeError('Application asset preload is missing its URL')
      references.push(attrs.get('href'))
    }
  }
  if (!hasModule) throw new SmokeError('Application root must link an application module script')
  return references
}

function staticImports(source) {
  const references = []
  // Skip strings and comments so documentation/examples inside a bundle cannot
  // become requests. Dynamic import expressions are deliberately not executed.
  for (let i = 0; i < source.length; i++) {
    const character = source[i]
    if (character === '"' || character === "'" || character === '`') {
      for (i++; i < source.length; i++) {
        if (source[i] === '\\') i++
        else if (source[i] === character) break
      }
    } else if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i + 2)
      i = end === -1 ? source.length : end
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2)
      if (end === -1) throw new SmokeError('Application asset contains an unterminated comment')
      i = end + 1
    } else if ((i === 0 || !/[A-Za-z0-9_$]/.test(source[i - 1])) && /^(?:import|export)\b/.test(source.slice(i, i + 7))) {
      const remainder = source.slice(i)
      const sideEffect = /^import\s*(["'])([^"'\r\n]*)\1/.exec(remainder)
      const from = /^(?:import|export)\s*(?:\{[^}]*\}|\*\s*(?:as\s+[A-Za-z_$][\w$]*)?|[A-Za-z_$][\w$]*(?:\s*,\s*(?:\{[^}]*\}|\*))?)\s*from\s*(["'])([^"'\r\n]*)\1/.exec(remainder)
      const match = sideEffect ?? from
      if (match) {
        references.push(match[2])
        i += match[0].length - 1
      }
    }
  }
  return references
}

function hasExpectedProject(source) {
  // Match a complete literal URL, never a hostname substring in a key,
  // another URL's path, a lookalike hostname, or HTML-only CSP evidence.
  const expected = `https://${releaseConfig.supabaseProjectRef}.supabase.co`
  for (const match of source.matchAll(/(["'`])(https:\/\/[^"'`\s\\]+)\1/g)) {
    if (match[2] === expected || match[2] === `${expected}/`) return true
  }
  return false
}

export async function publicSmoke({ url = releaseConfig.productionUrl, version, sha, allowLocal = false, fetchImpl = fetch } = {}) {
  try { validateVersion(version) } catch { throw new SmokeError('Expected release version must use stable x.y.z format') }
  try { validateSha(sha) } catch { throw new SmokeError('Expected release SHA must be a full lowercase 40-character Git SHA') }
  const root = rootUrl(url, allowLocal)
  const rootResponse = await requestText(root.href, 'Application root', limits.rootBytes, fetchImpl)
  const manifestResponse = await requestText(new URL('release.json', root).href, 'Release manifest', limits.manifestBytes, fetchImpl)
  let manifest
  try { manifest = JSON.parse(manifestResponse.text) } catch { throw new SmokeError('Release manifest is invalid JSON') }
  const manifestKeys = new Set()
  for (const match of manifestResponse.text.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
    if (!manifestResponse.text.slice(match.index + match[0].length).trimStart().startsWith(':')) continue
    let key
    try { key = JSON.parse(match[0]) } catch { throw new SmokeError('Release manifest is invalid JSON') }
    if (manifestKeys.has(key)) throw new SmokeError('Release manifest contains duplicate identity fields')
    manifestKeys.add(key)
  }
  if (!manifest || Array.isArray(manifest) || Object.keys(manifest).sort().join(',') !== 'app,gitSha,version' || manifest.app !== releaseConfig.app || manifest.version !== version || manifest.gitSha !== sha) {
    throw new SmokeError('Release manifest does not match the exact expected public build identity')
  }
  const queue = []
  const known = new Set()
  const enqueue = (reference, parent) => {
    const asset = assetUrl(reference, parent, root)
    if (known.has(asset)) return
    known.add(asset)
    if (known.size > limits.assets) throw new SmokeError('Application asset count exceeds the limit')
    queue.push(asset)
  }
  for (const reference of linkedAssets(rootResponse.text)) enqueue(reference, root)
  let bytes = 0
  let projectFound = false
  for (let i = 0; i < queue.length; i++) {
    const asset = queue[i]
    const response = await requestText(asset, 'Application asset', Math.min(limits.assetBytes, limits.totalAssetBytes - bytes), fetchImpl)
    bytes += response.bytes
    if (hasExpectedProject(response.text)) projectFound = true
    for (const reference of staticImports(response.text)) enqueue(reference, asset)
  }
  if (!projectFound) throw new SmokeError('Expected public Supabase project was not found in application assets')
  return { status: 'passed', mode: allowLocal ? 'local' : 'production', origin: root.origin, app: releaseConfig.app, version, gitSha: sha, rootStatus: 200, manifestStatus: 200, pagesBasePath: root.pathname, supabaseProjectRef: releaseConfig.supabaseProjectRef, assetsChecked: known.size }
}

if (isMain(import.meta.url)) {
  runCli(async () => {
    const args = parseArgs(process.argv.slice(2), { url: 'string', version: 'string', sha: 'string', json: 'boolean', 'allow-local': 'boolean' })
    const result = await publicSmoke({ ...args, allowLocal: args['allow-local'] })
    console.log(args.json ? JSON.stringify(result, null, 2) : `Public release smoke passed: ${result.app} ${result.version} ${result.gitSha}; ${result.assetsChecked} static assets checked`)
  })
}
