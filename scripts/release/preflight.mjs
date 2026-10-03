import { releaseConfig } from './config.mjs'
import { git, isMain, parseArgs, readPackage, repositoryRoot, runCli, runNpm, validateSha, validateVersion } from './common.mjs'
import { classifyImpact, validateRef } from './classify-impact.mjs'
import process from 'node:process'
import console from 'node:console'

/** Read-only preflight. Remote tag absence is checked only when explicitly requested. */
export function runPreflight({
  base = 'HEAD', sha, version, branch = 'master', ref,
  requireClean = false, requireTagAbsent = false, cwd = repositoryRoot,
} = {}, dependencies = {}) {
  const readGit = dependencies.git ?? git
  const getPackage = dependencies.readPackage ?? readPackage
  const npm = dependencies.runNpm ?? runNpm
  const classify = dependencies.classifyImpact ?? classifyImpact
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node
  const checks = []
  const passed = (name) => checks.push({ name, status: 'passed' })

  if (sha !== undefined) validateSha(sha)
  if (version !== undefined) validateVersion(version)
  validateRef(base)
  validateRef(branch)
  if (ref !== undefined) validateRef(ref)

  const gitSha = readGit(['rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}'], { cwd })
  validateSha(gitSha)
  if (sha !== undefined && gitSha !== sha) throw new Error('Checked-out SHA does not match the expected release SHA')
  const actualBranch = readGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
  if (actualBranch === 'HEAD') {
    if (ref === undefined && sha === undefined) throw new Error('Detached HEAD requires an explicit release SHA or ref')
  } else if (actualBranch !== branch) {
    throw new Error(`Release branch must be ${branch}; found ${actualBranch}`)
  }
  if (ref !== undefined) {
    const expectedRefSha = readGit(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], { cwd })
    validateSha(expectedRefSha)
    if (gitSha !== expectedRefSha) throw new Error('Checked-out SHA does not match the expected release ref')
  }
  const baseSha = readGit(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`], { cwd })
  validateSha(baseSha)
  passed('branch/ref and exact commit identity')

  if (requireClean) {
    if (readGit(['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd })) {
      throw new Error('Release requires a clean tree, including staged and untracked files')
    }
    passed('clean working tree')
  }
  if (nodeVersion !== releaseConfig.nodeVersion) {
    throw new Error(`Node version must be exactly ${releaseConfig.nodeVersion}; found ${nodeVersion}`)
  }
  const npmResult = npm(['--version'], { cwd, capture: true })
  const npmVersion = String(npmResult.stdout ?? '').trim()
  if (npmResult.status !== 0 || npmResult.error || npmVersion !== releaseConfig.npmVersion) {
    throw new Error(`npm version must be exactly ${releaseConfig.npmVersion}; version check failed or differed`)
  }
  passed('exact Node/npm versions')

  const packageVersion = getPackage(cwd).version
  validateVersion(packageVersion)
  if (version !== undefined && packageVersion !== version) throw new Error('Package version does not match the expected release version')
  passed('stable package version')

  if (requireTagAbsent) {
    const tag = `${releaseConfig.tagPrefix}${packageVersion}`
    const tagRef = `refs/tags/${tag}`
    const localRefs = readGit(['for-each-ref', '--format=%(refname)', tagRef], { cwd }).split(/\r?\n/)
    if (localRefs.includes(tagRef)) throw new Error(`Release tag ${tag} already exists locally`)
    const remoteRefs = readGit(['ls-remote', '--tags', 'origin', tagRef, `${tagRef}^{}`], { cwd })
    if (remoteRefs) throw new Error(`Release tag ${tag} already exists remotely`)
    passed('release tag absent locally and on origin')
  }

  readGit(['diff', '--check', `${baseSha}..${gitSha}`, '--'], { cwd })
  readGit(['diff', '--check', '--cached', '--'], { cwd })
  readGit(['diff', '--check', '--'], { cwd })
  passed('git diff --check for committed, staged and working-tree changes')

  const classification = classify({ base: baseSha, head: gitSha, cwd, includeWorkingTree: true })
  passed('conservative impact classification')
  return {
    status: 'passed', version: packageVersion, gitSha, branch: actualBranch, baseSha,
    impact: classification.impact, risk: classification.risk,
    providerCanaryRequired: classification.providerCanaryRequired, classification, checks,
  }
}

if (isMain(import.meta.url)) {
  runCli(() => {
    const args = parseArgs(process.argv.slice(2), {
      base: 'string', sha: 'string', version: 'string', branch: 'string', ref: 'string',
      'require-clean': 'boolean', 'require-tag-absent': 'boolean', json: 'boolean',
    })
    const result = runPreflight({
      base: args.base, sha: args.sha, version: args.version, branch: args.branch, ref: args.ref,
      requireClean: args['require-clean'] ?? false, requireTagAbsent: args['require-tag-absent'] ?? false,
    })
    if (!args.json) {
      console.log(`Release preflight passed: ${result.version} @ ${result.gitSha}`)
      console.log(`Impact ${result.impact}; Risk ${result.risk}; provider canary review: ${result.providerCanaryRequired ? 'required' : 'not indicated'}`)
      for (const check of result.checks) console.log(`PASS ${check.name}`)
    }
    console.log(JSON.stringify(result, null, 2))
  })
}
