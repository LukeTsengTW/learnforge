import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { snapshotSource } from './source.mjs'
import { classifyImpact } from './classify-impact.mjs'
import { runPreflight } from './preflight.mjs'
import { releaseConfig } from './config.mjs'
import { writeReport } from './report.mjs'

const roots = []
function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'learnforge-source-'))
  roots.push(cwd)
  fs.mkdirSync(path.join(cwd, 'src'))
  fs.writeFileSync(path.join(cwd, 'src/app.ts'), 'export const value = 1\n')
  const git = args => args[0] === 'rev-parse' ? 'a'.repeat(40)
    : args.includes('--stage') ? '100644 fixture 0\tsrc/app.ts\0'
      : args.includes('--others') ? '' : 'src/app.ts\0'
  return { cwd, dependencies: { git } }
}

function gitFixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'learnforge-source-git-'))
  roots.push(cwd)
  const runGit = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  runGit('init', '-b', 'master')
  runGit('config', 'core.autocrlf', 'false')
  fs.mkdirSync(path.join(cwd, 'src'))
  fs.writeFileSync(path.join(cwd, 'src/app.ts'), "import './output/payload.ts'\n")
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"learnforge","version":"1.3.0"}\n')
  fs.writeFileSync(path.join(cwd, '.gitignore'), 'output/\n/dist/\n/node_modules/\n/supabase/.temp/\n/supabase/.branches/\n/.env\n/.env.*\n')
  runGit('add', '--', '.gitignore', 'package.json', 'src/app.ts')
  runGit('-c', 'user.name=Release Test', '-c', 'user.email=release-test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'source fixture')
  const write = (file, content = 'export const payload = 1\n') => {
    const absolute = path.join(cwd, file)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, content)
  }
  return { cwd, runGit, write }
}
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })))

describe('release evidence source identity', () => {
  it('produces a deterministic content fingerprint', () => {
    const { cwd, dependencies } = fixture()
    expect(snapshotSource({ cwd }, dependencies)).toEqual(snapshotSource({ cwd }, dependencies))
    expect(snapshotSource({ cwd }, dependencies).sourceFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })
  it('changes when source changes without a new HEAD', () => {
    const { cwd, dependencies } = fixture()
    const before = snapshotSource({ cwd }, dependencies)
    fs.writeFileSync(path.join(cwd, 'src/app.ts'), 'export const value = 2\n')
    expect(snapshotSource({ cwd }, dependencies).sourceFingerprint).not.toBe(before.sourceFingerprint)
  })
  it('uses Git inventory so ignored build/report output does not stale evidence', () => {
    const { cwd, dependencies } = fixture()
    const before = snapshotSource({ cwd }, dependencies)
    fs.mkdirSync(path.join(cwd, 'output'))
    fs.writeFileSync(path.join(cwd, 'output/report.json'), '{}')
    expect(snapshotSource({ cwd }, dependencies)).toEqual(before)
  })
  it('detects tracked file deletion', () => {
    const { cwd, dependencies } = fixture()
    const before = snapshotSource({ cwd }, dependencies)
    fs.unlinkSync(path.join(cwd, 'src/app.ts'))
    expect(snapshotSource({ cwd }, dependencies).sourceFingerprint).not.toBe(before.sourceFingerprint)
  })
  it('detects staging identity changes', () => {
    const { cwd, dependencies } = fixture()
    const before = snapshotSource({ cwd }, dependencies)
    const git = args => args.includes('--stage') ? '100644 changed 0\tsrc/app.ts\0' : dependencies.git(args)
    expect(snapshotSource({ cwd }, { git }).sourceFingerprint).not.toBe(before.sourceFingerprint)
  })
  it('rejects inventory paths outside the repository', () => {
    const { cwd } = fixture()
    const git = args => args[0] === 'rev-parse' ? 'a'.repeat(40) : '../outside\0'
    expect(() => snapshotSource({ cwd }, { git })).toThrow(/path/)
  })
  it('rejects directories and unsupported files in the source inventory', () => {
    const { cwd, dependencies } = fixture()
    fs.unlinkSync(path.join(cwd, 'src/app.ts'))
    fs.mkdirSync(path.join(cwd, 'src/app.ts'))
    expect(() => snapshotSource({ cwd }, dependencies)).toThrow(/file/)
  })
  it('rejects a symlink ancestor before reading its target content', () => {
    const { cwd, dependencies } = fixture()
    const original = fs.lstatSync
    const ancestor = path.join(cwd, 'src')
    const spy = vi.spyOn(fs, 'lstatSync').mockImplementation(file => file === ancestor
      ? { isSymbolicLink: () => true, isDirectory: () => false }
      : original(file))
    try { expect(() => snapshotSource({ cwd }, dependencies)).toThrow(/ancestor/) }
    finally { spy.mockRestore() }
  })
})

describe('real Git ignored-source release guard', () => {
  it('blocks an ignored build-consumable source and rejects reuse of earlier evidence after its bytes change', () => {
    const { cwd, runGit, write } = gitFixture()
    const before = snapshotSource({ cwd })
    expect(before.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/)
    const checks = { ...before, version: '1.3.0', gitSha: runGit('rev-parse', 'HEAD'), ...classifyImpact({ cwd }), gates: {} }
    write('src/output/payload.ts')
    expect(runGit('check-ignore', '--', 'src/output/payload.ts')).toBe('src/output/payload.ts')
    expect(() => snapshotSource({ cwd })).toThrow(/ignored.*source.*src/i)
    expect(() => writeReport({ cwd, checks })).toThrow(/ignored.*source.*src/i)
    write('src/output/payload.ts', 'export const payload = 2\n')
    expect(() => snapshotSource({ cwd })).toThrow(/ignored.*source.*src/i)
    expect(() => writeReport({ cwd, checks })).toThrow(/ignored.*source.*src/i)
  })

  it('blocks classification with or without working-tree changes and blocks default preflight', () => {
    const { cwd, write } = gitFixture()
    write('src/output/payload.ts')
    expect(() => classifyImpact({ cwd })).toThrow(/ignored.*source/i)
    expect(() => classifyImpact({ cwd, includeWorkingTree: true })).toThrow(/ignored.*source/i)
    expect(() => runPreflight({ cwd }, {
      nodeVersion: releaseConfig.nodeVersion,
      runNpm: () => ({ status: 0, stdout: releaseConfig.npmVersion }),
    })).toThrow(/ignored.*source/i)
  })

  it('keeps legitimate ignored dist and output/release artifacts out of source evidence', () => {
    const { cwd, write } = gitFixture()
    const before = snapshotSource({ cwd })
    write('dist/assets/app.js', 'build one')
    write('output/release/checks.json', '{"status":"passed"}')
    expect(snapshotSource({ cwd })).toEqual(before)
    write('dist/assets/app.js', 'build two')
    write('output/release/checks.json', '{"status":"failed"}')
    expect(snapshotSource({ cwd })).toEqual(before)
    expect(classifyImpact({ cwd, includeWorkingTree: true }).files).toEqual([])
  })

  it.each([
    'scripts/output/hook.mjs', 'supabase/output/payload.sql',
    '.github/output/workflow.yml', 'public/output/site.js',
    'supabase/.temp/provider.ts', 'supabase/.branches/hidden.sql',
  ])('rejects nested ignored output in the relevant source root: %s', file => {
    const { cwd, write } = gitFixture()
    write(file)
    expect(() => snapshotSource({ cwd })).toThrow(/ignored.*source/i)
    expect(() => classifyImpact({ cwd })).toThrow(/ignored.*source/i)
  })

  it('excludes only recognized Supabase CLI metadata without excluding arbitrary source in its directories', () => {
    const { cwd, write } = gitFixture()
    const before = snapshotSource({ cwd })
    write('supabase/.temp/project-ref', 'fixture metadata')
    write('supabase/.branches/_current_branch', 'fixture branch')
    write('supabase/.temp/start-secrets/supabase_edge_runtime_fixture/env/docker.env', 'fixture environment')
    expect(snapshotSource({ cwd })).toEqual(before)
    expect(classifyImpact({ cwd, includeWorkingTree: true }).files).toEqual([])
    write('supabase/.temp/provider.ts')
    expect(() => snapshotSource({ cwd })).toThrow(/ignored.*source/i)
  })

  it.each([
    'vite.config.local.ts', 'tsconfig.local.json', 'eslint.config.local.js',
    '.oxlintrc.local.json', '.nvmrc', '.node-version', 'index.html', 'package-lock.json',
  ])('rejects ignored root build/config files: %s', file => {
    const { cwd, write } = gitFixture()
    fs.appendFileSync(path.join(cwd, '.gitignore'), `/${file}\n`)
    write(file)
    expect(() => snapshotSource({ cwd })).toThrow(/ignored.*source.*build\/config/i)
    expect(() => classifyImpact({ cwd })).toThrow(/ignored.*source/i)
  })

  it('detects actual untracked, staged, rename and delete source changes', () => {
    const { cwd, runGit, write } = gitFixture()
    const before = snapshotSource({ cwd })
    write('src/extra.ts')
    const untracked = snapshotSource({ cwd })
    expect(untracked).not.toEqual(before)
    runGit('add', '--', 'src/extra.ts')
    const staged = snapshotSource({ cwd })
    expect(staged).not.toEqual(untracked)
    fs.renameSync(path.join(cwd, 'src/extra.ts'), path.join(cwd, 'src/renamed.ts'))
    const renamed = snapshotSource({ cwd })
    expect(renamed).not.toEqual(staged)
    fs.unlinkSync(path.join(cwd, 'src/renamed.ts'))
    expect(snapshotSource({ cwd })).not.toEqual(renamed)
  })

  it('fingerprints ignored root dotenv build configuration without exposing its values', () => {
    const { cwd, runGit, write } = gitFixture()
    const before = snapshotSource({ cwd })
    write('.env.local', 'VITE_FIXTURE_VALUE=first\n')
    expect(runGit('check-ignore', '--', '.env.local')).toBe('.env.local')
    const first = snapshotSource({ cwd })
    const checks = { ...first, version: '1.3.0', gitSha: runGit('rev-parse', 'HEAD'), ...classifyImpact({ cwd, includeWorkingTree: true }), gates: {} }
    expect(first).not.toEqual(before)
    expect(JSON.stringify(first)).not.toContain('VITE_FIXTURE_VALUE')
    write('.env.local', 'VITE_FIXTURE_VALUE=second\n')
    expect(snapshotSource({ cwd })).not.toEqual(first)
    expect(() => writeReport({ cwd, checks })).toThrow(/stale.*source/i)
  })

  it.each([false, true])('routes ignored root build configuration to Risk C in every classification mode: %s', includeWorkingTree => {
    const { cwd, write } = gitFixture()
    write('.env.production.local', 'VITE_FIXTURE_VALUE=fixture\n')
    expect(classifyImpact({ cwd, includeWorkingTree })).toMatchObject({
      risk: 'C', providerCanaryRequired: false, files: ['.env.production.local'],
    })
    expect(runPreflight({ cwd }, {
      nodeVersion: releaseConfig.nodeVersion,
      runNpm: () => ({ status: 0, stdout: releaseConfig.npmVersion }),
    })).toMatchObject({ status: 'passed', risk: 'C' })
  })
})
