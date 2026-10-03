import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'
import { log } from 'node:console'
import { releaseConfig } from './config.mjs'
import { classifyImpact } from './classify-impact.mjs'
import { snapshotSource } from './source.mjs'
import { git, isMain, parseArgs, readPackage, repositoryRoot, runCli, validateSha, validateVersion } from './common.mjs'

export const gateNames = Object.freeze(['preflight', 'lint', 'test', 'quizzes', 'ai-context', 'edge-imports', 'build', 'manifest', 'audit', 'diff-check'])
const risks = { docs: ['A'], frontend: ['A', 'B'], backend: ['C'], 'security-ai': ['C'] }

function verifyIdentity(result, version, gitSha) {
  if (validateVersion(result.version) !== version || validateSha(result.gitSha) !== gitSha) {
    throw new Error('Release result identity does not match the report identity')
  }
}

function safeGate(gate) {
  if (!gate) return { status: 'not-run', exitCode: null }
  const { status, exitCode } = gate
  if (!['passed', 'failed', 'not-run'].includes(status)
    || (status === 'passed' && exitCode !== 0)
    || (status === 'failed' && (!Number.isInteger(exitCode) || exitCode === 0))
    || (status === 'not-run' && exitCode !== null)) throw new Error('Invalid release gate evidence')
  const result = { status, exitCode }
  if (gate.testCount !== undefined) {
    if (!Number.isInteger(gate.testCount) || gate.testCount < 0) throw new Error('Invalid test count evidence')
    result.testCount = gate.testCount
  }
  return result
}

function safeExternal(result, version, gitSha) {
  if (result === undefined) return { status: 'not-supplied' }
  verifyIdentity(result, version, gitSha)
  if (!['passed', 'failed'].includes(result.status)) throw new Error('Invalid deployment or smoke evidence')
  return { status: result.status }
}

function safeSmoke(result, version, gitSha) {
  const absent = () => ({ status: 'not-supplied' })
  if (result === undefined) return { publicSmoke: absent(), localSmoke: absent() }
  if (!result || typeof result !== 'object' || Array.isArray(result)
    || !['status', 'mode', 'origin', 'pagesBasePath', 'app', 'version', 'gitSha'].every(field => Object.hasOwn(result, field))) {
    throw new Error('Smoke evidence requires complete public identity and provenance')
  }
  verifyIdentity(result, version, gitSha)
  if (!['passed', 'failed'].includes(result.status) || result.app !== releaseConfig.app
    || result.pagesBasePath !== releaseConfig.pagesBasePath || typeof result.origin !== 'string') {
    throw new Error('Invalid smoke identity, status or Pages base path')
  }
  if (result.mode === 'production') {
    const origin = new URL(releaseConfig.productionUrl).origin
    if (result.origin !== origin) throw new Error('Production smoke origin does not match release configuration')
    return {
      publicSmoke: { status: result.status, mode: 'production', origin, pagesBasePath: releaseConfig.pagesBasePath },
      localSmoke: absent(),
    }
  }
  if (result.mode === 'local') {
    let destination
    try { destination = new URL(result.origin) }
    catch { throw new Error('Local smoke origin is invalid') }
    if (result.origin !== destination.origin || !['http:', 'https:'].includes(destination.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(destination.hostname)) {
      throw new Error('Local smoke origin must be canonical HTTP or HTTPS loopback')
    }
    return {
      publicSmoke: absent(),
      localSmoke: { status: result.status, mode: 'local', origin: destination.origin, pagesBasePath: releaseConfig.pagesBasePath },
    }
  }
  throw new Error('Smoke evidence mode must be production or local')
}

export function buildReport({ version, gitSha, baseSha, sourceFingerprint, classification, checks, deployment, smoke }) {
  validateVersion(version)
  validateSha(gitSha)
  if (!classification || !risks[classification.impact]?.includes(classification.risk)
    || typeof classification.providerCanaryRequired !== 'boolean') throw new Error('Invalid release impact classification')
  if (checks !== undefined) {
    verifyIdentity(checks, version, gitSha)
    if (validateSha(checks.baseSha) !== validateSha(baseSha)) throw new Error('Release checks use a different comparison base')
    if (typeof checks.sourceFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(checks.sourceFingerprint)
      || checks.sourceFingerprint !== sourceFingerprint) throw new Error('Release checks are stale for the current source content')
    if (checks.impact !== classification.impact || checks.risk !== classification.risk
      || checks.providerCanaryRequired !== classification.providerCanaryRequired) throw new Error('Release checks have a different impact classification')
  }
  const gates = Object.fromEntries(gateNames.map(name => [name, safeGate(checks?.gates?.[name])]))
  const deploymentResult = safeExternal(deployment, version, gitSha)
  const { publicSmoke, localSmoke } = safeSmoke(smoke, version, gitSha)
  const statuses = [...Object.values(gates), deploymentResult, publicSmoke, localSmoke].map(result => result.status)
  const status = statuses.includes('failed') ? 'failed' : Object.values(gates).every(gate => gate.status === 'passed') ? 'passed' : 'incomplete'
  return {
    app: releaseConfig.app, version, gitSha, baseSha, sourceFingerprint,
    impact: classification.impact, risk: classification.risk, providerCanaryRequired: classification.providerCanaryRequired,
    status, gates, test: gates.test, build: gates.build, deployment: deploymentResult, publicSmoke, localSmoke,
  }
}

export function readResult(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { throw new Error('Cannot read valid release result JSON') }
}

export function writeReport({ cwd = repositoryRoot, base = 'HEAD', checks, deployment, smoke } = {}) {
  const version = validateVersion(readPackage(cwd).version)
  const gitSha = validateSha(git(['rev-parse', '--verify', 'HEAD^{commit}'], { cwd }))
  const classification = classifyImpact({ base, head: 'HEAD', cwd, includeWorkingTree: true })
  const source = snapshotSource({ cwd, base })
  const report = buildReport({ version, gitSha, ...source, classification, checks, deployment, smoke })
  const directory = path.join(cwd, 'output/release')
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  const lines = [
    `# ${releaseConfig.app} release checks`, '', `Version: ${version}`, `SHA: ${gitSha}`,
    `Comparison base: ${report.baseSha}`, `Source fingerprint: ${report.sourceFingerprint}`,
    `Impact: ${report.impact}; risk ${report.risk}; provider canary required: ${report.providerCanaryRequired}`,
    `Local checks: ${report.status}`, '', '| Gate | Result | Exit |', '| --- | --- | --- |',
    ...Object.entries(report.gates).map(([name, result]) => `| ${name} | ${result.status} | ${result.exitCode ?? '-'} |`),
    '', `Test count: ${report.test.testCount ?? 'not supplied'}`,
    `Build: ${report.build.status}`, `Deployment: ${report.deployment.status}`, `Public smoke: ${report.publicSmoke.status}`,
    `Local smoke: ${report.localSmoke.status}`,
    '', 'This report is evidence of supplied checks, not authorization to mutate production or create a tag.', '',
  ]
  fs.writeFileSync(path.join(directory, 'report.md'), lines.join('\n'))
  return report
}

if (isMain(import.meta.url)) {
  await runCli(() => {
    const options = parseArgs(process.argv.slice(2), { base: 'string', checks: 'string', 'deployment-result': 'string', 'smoke-result': 'string' })
    const defaultChecks = path.join(repositoryRoot, 'output/release/checks.json')
    const checksFile = options.checks ?? (fs.existsSync(defaultChecks) ? defaultChecks : undefined)
    const report = writeReport({ base: options.base, checks: checksFile ? readResult(checksFile) : undefined,
      deployment: options['deployment-result'] ? readResult(options['deployment-result']) : undefined,
      smoke: options['smoke-result'] ? readResult(options['smoke-result']) : undefined })
    log(`output/release/report.json and report.md: ${report.status}`)
    if (report.status !== 'passed') process.exitCode = 1
  })
}
