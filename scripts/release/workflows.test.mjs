import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { runInNewContext } from 'node:vm'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { releaseConfig } from './config.mjs'

const deploy = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
const sha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)
const version = '1.4.0'
const gates = [
  'npm ci',
  'npm run lint',
  'npm run test',
  'npm run check:quizzes',
  'npm run check:ai-context',
  'npm run check:edge-imports',
  'npm run build',
  'npm audit --omit=dev',
]

function inlineNode(stepName) {
  const start = deploy.indexOf(`- name: ${stepName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const match = deploy.slice(start).match(/node --input-type=module <<'NODE'\r?\n([\s\S]*?)^\s*NODE$/m)
  expect(match).not.toBeNull()
  return match[1].replace(/^\s*import .*?;\r?$/gm, '')
}

function verifyInputs(env = {}) {
  runInNewContext(inlineNode('Validate release inputs and workflow identity'), {
    process: { env: { RELEASE_SHA: sha, RELEASE_VERSION: version, GITHUB_SHA: sha, GITHUB_REF: 'refs/heads/master', ...env } },
  })
}

function verifyBeforeDeploy({ ref = 'refs/heads/master', eventSha = sha, head = sha, remote = `${sha}\trefs/heads/master`, remoteExit = '0' } = {}) {
  const step = deploy.match(/- name: Recheck release identity immediately before deployment\r?\n\s+run: \|\r?\n([\s\S]*?)(?=\r?\n\s+- name: Deploy)/)
  expect(step).not.toBeNull()
  const guard = step[1].replace(/^ {10}/gm, '')
  const fakeGit = `git() {
    if [ "$*" = 'rev-parse HEAD' ]; then
      printf '%s\\n' "$TEST_HEAD"
    elif [ "$*" = 'ls-remote --exit-code origin refs/heads/master' ]; then
      printf '%s\\n' "$TEST_REMOTE_IDENTITY"
      return "$TEST_REMOTE_EXIT"
    else
      return 99
    fi
  }
  `
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
  execFileSync(bash, ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', fakeGit + guard], {
    encoding: 'utf8',
    env: { ...process.env, RELEASE_SHA: sha, GITHUB_SHA: eventSha, GITHUB_REF: ref, TEST_HEAD: head, TEST_REMOTE_IDENTITY: remote, TEST_REMOTE_EXIT: remoteExit },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function verifyCheckout({ head = sha, remote = `${sha}\trefs/heads/master`, packageVersion = version, remoteError = false } = {}) {
  runInNewContext(inlineNode('Verify checked-out release, remote master, and package version'), {
    process: { env: { RELEASE_SHA: sha, RELEASE_VERSION: version } },
    execFileSync(command, args) {
      expect(command).toBe('git')
      if (args[0] === 'rev-parse') return head
      expect(args).toEqual(['ls-remote', '--exit-code', 'origin', 'refs/heads/master'])
      if (remoteError) throw new Error('Remote lookup failed')
      return remote
    },
    readFileSync(path) {
      expect(path).toBe('package.json')
      return JSON.stringify({ version: packageVersion })
    },
  })
}

describe('release workflow contracts', () => {
  it('runs every CI gate with read-only permissions for pull requests and master pushes', () => {
    expect(ci).toMatch(/pull_request:/)
    expect(ci).toMatch(/push:\s*branches: \[master\]/)
    expect(ci).toMatch(/permissions:\s*contents: read/)
    expect(ci).not.toMatch(/:\s*write\b/)
    expect(ci).not.toMatch(/deploy-pages|workflow_dispatch/)
    for (const gate of gates) expect(ci).toContain(gate)
    expect(ci).toContain(`node-version: '${releaseConfig.nodeVersion}'`)
    expect(ci).toContain(`"${releaseConfig.npmVersion}"`)
    expect(ci).toContain("VITE_TURNSTILE_SITE_KEY: ''")
  })

  it('requires explicit identity and an exact checkout for manual deployment only', () => {
    const triggers = deploy.slice(deploy.indexOf('on:'), deploy.indexOf('permissions:'))
    expect(triggers).toContain('workflow_dispatch:')
    expect(triggers).not.toMatch(/push:|pull_request:|schedule:/)
    for (const input of ['release_sha', 'release_version']) {
      expect(triggers).toMatch(new RegExp(`${input}:\\s+description:[^\\n]+\\s+required: true\\s+type: string`))
    }
    expect(deploy.match(/ref: \$\{\{ inputs\.release_sha \}\}/g)).toHaveLength(2)
    expect(deploy).toContain('fetch-depth: 0')
    expect(deploy).toContain('cancel-in-progress: false')
    expect(deploy.indexOf('Validate release inputs')).toBeLessThan(deploy.indexOf('actions/checkout'))
    expect(deploy.indexOf('Verify checked-out release')).toBeLessThan(deploy.indexOf('npm ci'))
  })

  it('runs all release gates and includes manifest and fresh identity checks in the Pages artifact', () => {
    for (const gate of gates) expect(deploy).toContain(gate)
    expect(deploy).toContain(`name: ${releaseConfig.workflowName}`)
    expect(deploy).toContain(`node-version: '${releaseConfig.nodeVersion}'`)
    expect(deploy).toContain(`"${releaseConfig.npmVersion}"`)
    expect(deploy).toContain('releaseConfig.pagesBasePath')
    expect(deploy.indexOf('release:manifest')).toBeLessThan(deploy.indexOf('actions/upload-pages-artifact'))
    expect(deploy.indexOf('Recheck release identity immediately before deployment')).toBeLessThan(deploy.indexOf('actions/deploy-pages'))
    expect(deploy.match(/git ls-remote --exit-code origin refs\/heads\/master/g)).toHaveLength(2)
  })

  it('retains only existing public VITE build variables and adds no production secrets', () => {
    const variables = [...deploy.matchAll(/^\s+(VITE_[A-Z_]+): \$\{\{ vars\./gm)].map(match => match[1]).sort()
    expect(variables).toEqual(['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL', 'VITE_TURNSTILE_SITE_KEY'])
    expect(deploy).not.toContain('${{ secrets.')
    expect(deploy).toContain("VITE_TURNSTILE_SITE_KEY: ''")
  })
})

describe('deployment identity guards execute fail closed', () => {
  it('accepts an exact stable version and workflow SHA', () => {
    expect(() => verifyInputs()).not.toThrow()
    expect(() => verifyCheckout()).not.toThrow()
    expect(() => verifyBeforeDeploy()).not.toThrow()
  })

  it.each(['refs/heads/release-test', 'refs/tags/v1.4.0', '', 'master'])('rejects dispatch ref %s even at the exact release SHA', ref => {
    expect(() => verifyInputs({ GITHUB_REF: ref })).toThrow(/refs\/heads\/master/)
    expect(() => verifyBeforeDeploy({ ref })).toThrow()
  })

  it.each(['master', 'a'.repeat(39), 'A'.repeat(40), `${sha};echo bad`])('rejects a malformed release SHA: %s', invalidSha => {
    expect(() => verifyInputs({ RELEASE_SHA: invalidSha })).toThrow(/full lowercase 40-character SHA/)
  })

  it.each(['v1.4.0', '01.4.0', '1.4', '1.4.0-rc.1'])('rejects a non-stable release version: %s', invalidVersion => {
    expect(() => verifyInputs({ RELEASE_VERSION: invalidVersion })).toThrow(/stable major.minor.patch/)
  })

  it('rejects a workflow revision from a different commit', () => {
    expect(() => verifyInputs({ GITHUB_SHA: otherSha })).toThrow(/workflow revision/)
  })

  it('rejects a checkout mismatch', () => {
    expect(() => verifyCheckout({ head: otherSha })).toThrow(/Checked-out HEAD/)
  })

  it('rejects a remote master mismatch', () => {
    expect(() => verifyCheckout({ remote: `${otherSha}\trefs/heads/master` })).toThrow(/Remote master/)
    expect(() => verifyBeforeDeploy({ remote: `${otherSha}\trefs/heads/master` })).toThrow()
  })

  it.each(['', `${sha}\trefs/heads/other`, `${sha}\trefs/heads/master\n${otherSha}\trefs/heads/master`, `${sha}\trefs/heads/master extra`])('rejects an absent or ambiguous remote identity', remote => {
    expect(() => verifyCheckout({ remote })).toThrow(/Remote master/)
  })

  it('rejects a failed remote lookup', () => {
    expect(() => verifyCheckout({ remoteError: true })).toThrow(/Remote lookup failed/)
    expect(() => verifyBeforeDeploy({ remoteExit: '2' })).toThrow()
  })

  it('rejects a package version mismatch', () => {
    expect(() => verifyCheckout({ packageVersion: '1.3.0' })).toThrow(/package.json version/)
  })
})
