import { git, isMain, parseArgs, repositoryRoot, runCli, validateSha } from './common.mjs'
import { readSourceInventory } from './source-inventory.mjs'
import process from 'node:process'
import console from 'node:console'

const impactRank = { docs: 0, frontend: 1, backend: 2, 'security-ai': 3 }
const riskRank = { A: 0, B: 1, C: 2 }
const documentation = /^(?:docs\/.*\.(?:md|mdx|txt)|(?:README|CHANGELOG|CONTRIBUTING|LICENSE|SECURITY|AGENTS|RTK)\.md)$/i
const providerSensitive = /(?:grading|provider|raster|prompt|evidence|rubric|semantic[-_]?fill|ai[-_/](?:tutor|feedback|explain|quiz|context|client)|(?:^|[/_.-])model(?:[-_.]|$))/i
const securitySensitive = /(?:auth|security|csp|turnstile|captcha|recover|password|account|permission|privilege|(?:^|[/_.-])(?:policy|acl|rls|quota)(?:[/_.-]|$)|owner[-_]binding|rate[-_]limit)/i
const frontendSource = /\.(?:tsx?|jsx?|css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|woff2?)$/i
const presentationAsset = /\.(?:css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|woff2?)$/i
const knownFrontendPath = /^src\/(?:(?:components|content|lib|models|pages|styles|types)\/|features\/(?:ai|analytics|auth|author|quiz)\/|(?:App(?:\.[^/]*)?|main)\.(?:tsx?|jsx?))/
const providerBoundary = /^(?:src\/(?:features\/ai\/|lib\/ai[^/]*\.)|supabase\/functions\/(?:ai-[^/]+|submit-quiz)\/)/i
const providerAccounting = /(?:^|[/_.-])ai[-_](?:request|response|cache|ledger|model|evidence)(?:[/_.-]|$)/i
const testFile = /(?:^|\/)[^/]+\.(?:test|spec|test-helper)\.[^/]+$/i
const testDirectory = /(?:^|\/)(?:test|tests|__tests__)\//i
const documentationDirectory = /(?:^|\/)docs?\//i
const documentationName = /(?:^|\/)(?:README|CHANGELOG|CONTRIBUTING|LICENSE|SECURITY|AGENTS|RTK)\.(?:md|mdx|txt)$/i
const releaseInfrastructure = /^(?:scripts\/release\/|\.github\/)/i

function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

function hasControlCharacters(value) {
  return [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}

export function validateRef(value) {
  if (typeof value !== 'string' || !value || value.startsWith('-') || /\s/.test(value) || hasControlCharacters(value)) {
    throw new Error('Comparison ref must be a nonempty Git ref without option prefixes or whitespace')
  }
  return value
}

function classifyPath(path) {
  if (documentation.test(path)) return { impact: 'docs', risk: 'A', providerCanaryRequired: false, reason: 'Known documentation' }
  if (releaseInfrastructure.test(path)) {
    return { impact: 'security-ai', risk: 'C', providerCanaryRequired: false, reason: 'Release infrastructure requires security and release review' }
  }
  if (providerSensitive.test(path) || providerBoundary.test(path) || providerAccounting.test(path)) {
    const providerCanaryRequired = !(testFile.test(path) || testDirectory.test(path)
      || documentationDirectory.test(path) || documentationName.test(path) || presentationAsset.test(path))
    return {
      impact: 'security-ai', risk: 'C', providerCanaryRequired,
      reason: providerCanaryRequired
        ? 'Provider, grading, raster, prompt, model or evidence production behavior requires canary review'
        : 'Sensitive test, documentation or presentation change requires review without a provider canary',
    }
  }
  if (securitySensitive.test(path) || path === 'src/lib/supabase.ts') {
    return { impact: 'security-ai', risk: 'C', providerCanaryRequired: false, reason: 'Auth or security boundary' }
  }
  if (/^supabase\/(?:migrations|functions|tests)\//.test(path)) {
    return { impact: 'backend', risk: 'C', providerCanaryRequired: false, reason: 'Database or Edge behavior' }
  }
  if ((/^src\/(?:styles|components)\//.test(path) && presentationAsset.test(path)) || (/^public\//.test(path) && presentationAsset.test(path))) {
    return { impact: 'frontend', risk: 'A', providerCanaryRequired: false, reason: 'Frontend presentation' }
  }
  if ((knownFrontendPath.test(path) && frontendSource.test(path)) || /^(?:src\/content|public)\/quizzes\/.*\.(?:md|json|txt)$/i.test(path)) {
    return { impact: 'frontend', risk: 'B', providerCanaryRequired: false, reason: 'Frontend or domain behavior' }
  }
  return { impact: 'security-ai', risk: 'C', providerCanaryRequired: false, reason: 'Unrecognized path requires manual security and release review' }
}

/** Path rules are conservative routing guidance, not proof that a provider canary has passed. */
export function classifyPaths(paths, { deletedPaths = [], unresolvedPaths = [] } = {}) {
  if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string' || !path)) {
    throw new Error('Changed files must be an array of nonempty paths')
  }
  const normalize = (path) => path.replaceAll('\\', '/')
  const files = [...new Set(paths.map(normalize))].sort(compare)
  const deleted = new Set(deletedPaths.map(normalize))
  const unresolved = new Set(unresolvedPaths.map(normalize))
  let impact = 'docs'
  let risk = 'A'
  let providerCanaryRequired = false
  const reasons = []
  for (const path of files) {
    const unsafe = path.startsWith('/') || path.split('/').includes('..') || hasControlCharacters(path)
    const classification = unsafe
      ? { impact: 'security-ai', risk: 'C', providerCanaryRequired: false, reason: 'Unsafe or unrecognized path requires manual review' }
      : classifyPath(path)
    if (deleted.has(path) || unresolved.has(path)) {
      classification.impact = 'security-ai'
      classification.risk = 'C'
      classification.reason = `${classification.reason}; ${deleted.has(path) ? 'deletion' : 'unresolved change'} requires manual review`
    }
    if (impactRank[classification.impact] > impactRank[impact]) impact = classification.impact
    if (riskRank[classification.risk] > riskRank[risk]) risk = classification.risk
    providerCanaryRequired ||= classification.providerCanaryRequired
    reasons.push(`${path}: ${classification.reason}`)
  }
  if (!files.length) reasons.push('No changed files')
  return { impact, risk, providerCanaryRequired, files, reasons }
}

/** Parse -z name-status output, retaining BOTH names in renamed/copied records. */
export function parseNameStatus(output) {
  if (!output) return []
  if (!output.endsWith('\0')) throw new Error('Malformed Git diff name-status output: missing NUL terminator')
  const parts = output.split('\0')
  if (parts.at(-1) === '') parts.pop()
  const changes = []
  for (let index = 0; index < parts.length;) {
    const status = parts[index++]
    if (!/^(?:[AMDTUXB]|[RC]\d{1,3})$/.test(status)) throw new Error(`Unrecognized Git diff status: ${status}`)
    const count = /^[RC]/.test(status) ? 2 : 1
    const paths = parts.slice(index, index + count)
    if (paths.length !== count || paths.some((path) => !path)) throw new Error('Malformed Git diff name-status record')
    index += count
    changes.push({ status, paths })
  }
  return changes
}

export function classifyImpact({ base = 'HEAD', head = 'HEAD', cwd = repositoryRoot, includeWorkingTree = false } = {}, dependencies = {}) {
  const readGit = dependencies.git ?? git
  validateRef(base)
  validateRef(head)
  const inventory = readSourceInventory({ cwd }, { git: readGit })
  const baseSha = readGit(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`], { cwd })
  const headSha = readGit(['rev-parse', '--verify', '--end-of-options', `${head}^{commit}`], { cwd })
  validateSha(baseSha)
  validateSha(headSha)
  const changes = parseNameStatus(readGit(['diff', '--name-status', '-z', '-M', `${baseSha}..${headSha}`, '--'], { cwd }))
  // Ignored build configuration has no committed baseline. Always surface it
  // for conservative review, even in an otherwise committed-only comparison.
  changes.push(...inventory.ignoredConfig.map(path => ({ status: 'A', paths: [path] })))
  if (includeWorkingTree) {
    changes.push(...parseNameStatus(readGit(['diff', '--cached', '--name-status', '-z', '-M', headSha, '--'], { cwd })))
    changes.push(...parseNameStatus(readGit(['diff', '--name-status', '-z', '-M', '--'], { cwd })))
    changes.push(...inventory.untracked.map((path) => ({ status: 'A', paths: [path] })))
  }
  return classifyPaths(changes.flatMap((change) => change.paths), {
    deletedPaths: changes.filter((change) => change.status === 'D').flatMap((change) => change.paths),
    unresolvedPaths: changes.filter((change) => /^[TUXB]/.test(change.status)).flatMap((change) => change.paths),
  })
}

if (isMain(import.meta.url)) {
  runCli(() => {
    const args = parseArgs(process.argv.slice(2), { base: 'string', head: 'string', json: 'boolean', 'include-working-tree': 'boolean' })
    const result = classifyImpact({ base: args.base, head: args.head, includeWorkingTree: args['include-working-tree'] ?? false })
    if (!args.json) {
      console.log(`Release impact: ${result.impact}; Risk ${result.risk}; provider canary review: ${result.providerCanaryRequired ? 'required' : 'not indicated'}`)
      for (const reason of result.reasons) console.log(`- ${reason}`)
    }
    console.log(JSON.stringify(result, null, 2))
  })
}
