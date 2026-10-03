import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { writeManifest } from './write-manifest.mjs'

const roots = []
function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'learnforge-manifest-'))
  roots.push(cwd)
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git(['init', '-q'])
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'learnforge', version: '1.3.0' }))
  git(['add', 'package.json'])
  git(['-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture'])
  fs.mkdirSync(path.join(cwd, 'dist'))
  fs.writeFileSync(path.join(cwd, 'dist/index.html'), '<html></html>')
  return { cwd, sha: git(['rev-parse', 'HEAD']) }
}
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })))

describe('public release manifest', () => {
  it('writes deterministic public identity for the exact checked-out commit', () => {
    const { cwd, sha } = fixture()
    writeManifest({ cwd, sha })
    const file = path.join(cwd, 'dist/release.json')
    const first = fs.readFileSync(file, 'utf8')
    expect(JSON.parse(first)).toEqual({ app: 'learnforge', version: '1.3.0', gitSha: sha })
    writeManifest({ cwd, sha })
    expect(fs.readFileSync(file, 'utf8')).toBe(first)
  })
  it('refuses a supplied SHA that differs from HEAD', () => {
    const { cwd } = fixture()
    expect(() => writeManifest({ cwd, sha: 'a'.repeat(40) })).toThrow(/HEAD/)
    expect(fs.existsSync(path.join(cwd, 'dist/release.json'))).toBe(false)
  })
  it('requires an existing production build', () => {
    const { cwd } = fixture()
    fs.unlinkSync(path.join(cwd, 'dist/index.html'))
    expect(() => writeManifest({ cwd })).toThrow(/build/)
  })
  it('rejects invalid package versions before writing', () => {
    const { cwd } = fixture()
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ version: '01.3.0' }))
    expect(() => writeManifest({ cwd })).toThrow(/version/)
  })
})
