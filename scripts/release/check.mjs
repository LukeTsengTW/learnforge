import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { log } from 'node:console'
import { releaseConfig } from './config.mjs'
import { classifyImpact } from './classify-impact.mjs'
import { runPreflight } from './preflight.mjs'
import { writeManifest } from './write-manifest.mjs'
import { writeReport } from './report.mjs'
import { snapshotSource } from './source.mjs'
import { git, isMain, parseArgs, readPackage, repositoryRoot, runCli, runNpm, validateSha, validateVersion } from './common.mjs'

export function executeGates(definitions, onResult = () => {}) {
  const results = Object.fromEntries(definitions.map(({ name }) => [name, { status: 'not-run', exitCode: null }]))
  for (const { name, run } of definitions) {
    let result
    try { result = run() }
    catch { result = { status: 1 } }
    const exitCode = Number.isInteger(result?.status) ? result.status : 1
    const gate = { status: exitCode === 0 ? 'passed' : 'failed', exitCode }
    if (name === 'test' && typeof result?.stdout === 'string') {
      const summary = result.stdout.match(/Tests\s+[^\r\n]*?\((\d+)\)/)
      if (summary) gate.testCount = Number(summary[1])
    }
    results[name] = gate
    onResult(name, gate)
    if (exitCode !== 0) break
  }
  return results
}

export function runReleaseChecks({ cwd = repositoryRoot, base = 'HEAD', requireClean = false } = {}) {
  const version = validateVersion(readPackage(cwd).version)
  const gitSha = validateSha(git(['rev-parse', '--verify', 'HEAD^{commit}'], { cwd }))
  const source = snapshotSource({ cwd, base })
  const npmGate = (name, args, env = process.env) => ({ name, run: () => runNpm(args, { cwd, env }) })
  const definitions = [
    { name: 'preflight', run: () => { runPreflight({ cwd, base, requireClean }); return { status: 0 } } },
    npmGate('lint', ['run', 'lint']),
    npmGate('test', ['run', 'test'], { ...process.env, VITE_TURNSTILE_SITE_KEY: '' }),
    npmGate('quizzes', ['run', 'check:quizzes']),
    npmGate('ai-context', ['run', 'check:ai-context']),
    npmGate('edge-imports', ['run', 'check:edge-imports']),
    npmGate('build', ['run', 'build', '--', `--base=${releaseConfig.pagesBasePath}`]),
    { name: 'manifest', run: () => { writeManifest({ cwd, sha: gitSha }); return { status: 0 } } },
    npmGate('audit', ['audit', '--omit=dev']),
    { name: 'diff-check', run: () => {
      git(['diff', '--check', base, 'HEAD', '--'], { cwd })
      git(['diff', '--check'], { cwd })
      git(['diff', '--cached', '--check'], { cwd })
      return { status: 0 }
    } },
  ]
  const stable = () => {
    const current = snapshotSource({ cwd, base })
    if (current.baseSha !== source.baseSha || current.sourceFingerprint !== source.sourceFingerprint) {
      throw new Error('Release source changed during the gate run')
    }
  }
  const guarded = definitions.map(definition => ({ ...definition, run: () => {
    stable()
    const result = definition.run()
    stable()
    return result
  } }))
  const gates = executeGates(guarded, (name, result) => log(`${name}: ${result.status} (exit ${result.exitCode})`))
  const classification = classifyImpact({ base, head: 'HEAD', cwd, includeWorkingTree: true })
  const checks = { version, gitSha, ...source, impact: classification.impact, risk: classification.risk,
    providerCanaryRequired: classification.providerCanaryRequired, gates }
  const directory = path.join(cwd, 'output/release')
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, 'checks.json'), JSON.stringify(checks, null, 2) + '\n')
  return writeReport({ cwd, base, checks })
}

if (isMain(import.meta.url)) {
  await runCli(() => {
    const options = parseArgs(process.argv.slice(2), { base: 'string', 'require-clean': 'boolean' })
    const report = runReleaseChecks({ base: options.base, requireClean: options['require-clean'] })
    log(`Local release checks: ${report.status}; deployment/public smoke: not supplied`)
    if (report.status !== 'passed') process.exitCode = 1
  })
}
