import { describe, expect, it, vi } from 'vitest'
import { runPreflight } from './preflight.mjs'
import { releaseConfig } from './config.mjs'

const sha = 'a'.repeat(40)
const impact = { impact: 'docs', risk: 'A', providerCanaryRequired: false, files: [], reasons: [] }

function dependencies(overrides = {}) {
  return {
    git: vi.fn((args) => {
      if (args[0] === 'rev-parse' && args.includes('--abbrev-ref')) return 'master'
      if (args[0] === 'rev-parse') return sha
      return ''
    }),
    readPackage: () => ({ version: '1.3.0' }),
    runNpm: () => ({ status: 0, stdout: `${releaseConfig.npmVersion}\n`, stderr: '' }),
    nodeVersion: releaseConfig.nodeVersion,
    classifyImpact: vi.fn(() => impact),
    ...overrides,
  }
}

describe('read-only release preflight', () => {
  it('checks exact identity, runtime, version, whitespace and working-tree impact', () => {
    const deps = dependencies()
    expect(runPreflight({ sha, version: '1.3.0' }, deps)).toMatchObject({
      status: 'passed', version: '1.3.0', gitSha: sha, branch: 'master', impact: 'docs', classification: impact,
    })
    expect(deps.classifyImpact).toHaveBeenCalledWith(expect.objectContaining({ includeWorkingTree: true }))
    expect(deps.git.mock.calls.filter(([args]) => args[0] === 'diff' && args.includes('--check')))
      .toHaveLength(3)
    expect(deps.git.mock.calls.every(([args]) => ['rev-parse', 'status', 'diff', 'for-each-ref', 'ls-remote'].includes(args[0])))
      .toBe(true)
  })

  it.each(['01.3.0', 'v1.3.0', '1.3', '1.3.0-beta.1', '1.3.0+build'])('rejects unsupported release versions: %s', (version) => {
      expect(() => runPreflight({ version }, dependencies())).toThrow(/version/i)
  })

  it.each(['a'.repeat(39), 'A'.repeat(40), 'main', `${sha}\n`])('rejects abbreviated, uppercase or malformed expected SHA: %s', (value) => {
      expect(() => runPreflight({ sha: value }, dependencies())).toThrow(/sha/i)
  })

  it('rejects a package version or checked-out SHA mismatch', () => {
    expect(() => runPreflight({ version: '1.4.0' }, dependencies())).toThrow(/package version/i)
    expect(() => runPreflight({ sha: 'b'.repeat(40) }, dependencies())).toThrow(/SHA/i)
  })

  it('rejects malformed package versions and exact runtime mismatches', () => {
    expect(() => runPreflight({}, dependencies({ readPackage: () => ({ version: '1.3.0-beta' }) })))
      .toThrow(/version/i)
    expect(() => runPreflight({}, dependencies({ nodeVersion: '24.21.1' }))).toThrow(/Node/i)
    expect(() => runPreflight({}, dependencies({ runNpm: () => ({ status: 0, stdout: '11.19.1' }) })))
      .toThrow(/npm/i)
    expect(() => runPreflight({}, dependencies({ runNpm: () => ({ status: 1, stderr: 'failure' }) })))
      .toThrow(/npm/i)
  })

  it('rejects other branches and allows detached HEAD only with exact ref or SHA', () => {
    const onBranch = (branch) => dependencies({ git: vi.fn((args) =>
      args[0] === 'rev-parse' ? (args.includes('--abbrev-ref') ? branch : sha) : '') })
    expect(() => runPreflight({}, onBranch('feature'))).toThrow(/branch/i)
    expect(() => runPreflight({}, onBranch('HEAD'))).toThrow(/detached/i)
    expect(runPreflight({ sha }, onBranch('HEAD')).branch).toBe('HEAD')
    expect(runPreflight({ ref: 'v1.3.0' }, onBranch('HEAD')).branch).toBe('HEAD')
  })

  it('fails closed when the requested ref does not match HEAD', () => {
    const deps = dependencies({ git: vi.fn((args) => {
      if (args.includes('--abbrev-ref')) return 'master'
      if (args.some((arg) => arg === 'v1.3.0^{commit}')) return 'b'.repeat(40)
      return args[0] === 'rev-parse' ? sha : ''
    }) })
    expect(() => runPreflight({ ref: 'v1.3.0' }, deps)).toThrow(/ref/i)
    expect(() => runPreflight({ ref: '--bad' }, dependencies())).toThrow(/ref/i)
  })

  it('enforces requested clean-tree validation including untracked files', () => {
    const deps = dependencies({ git: vi.fn((args) => {
      if (args[0] === 'status') return '?? new.txt\0'
      if (args[0] === 'rev-parse') return args.includes('--abbrev-ref') ? 'master' : sha
      return ''
    }) })
    expect(() => runPreflight({ requireClean: true }, deps)).toThrow(/clean/i)
    expect(runPreflight({}, deps).status).toBe('passed')
  })

  it('rejects local or remote release tags and verifies both exact remote tag forms', () => {
    const tag = `${releaseConfig.tagPrefix}1.3.0`
    const local = dependencies({ git: vi.fn((args) => {
      if (args[0] === 'for-each-ref') return `refs/tags/${tag}`
      if (args[0] === 'rev-parse') return args.includes('--abbrev-ref') ? 'master' : sha
      return ''
    }) })
    expect(() => runPreflight({ requireTagAbsent: true }, local)).toThrow(/tag.*exist/i)
    const remote = dependencies({ git: vi.fn((args) => {
      if (args[0] === 'ls-remote') return `${sha}\trefs/tags/${tag}^{}`
      if (args[0] === 'rev-parse') return args.includes('--abbrev-ref') ? 'master' : sha
      return ''
    }) })
    expect(() => runPreflight({ requireTagAbsent: true }, remote)).toThrow(/tag.*exist/i)
    expect(remote.git).toHaveBeenCalledWith(expect.arrayContaining([`refs/tags/${tag}`, `refs/tags/${tag}^{}`]), expect.anything())
  })

  it('fails closed on remote tag lookup and whitespace-check errors', () => {
    const fail = (command) => dependencies({ git: vi.fn((args) => {
      if (args[0] === command) throw new Error(`Cannot ${command}`)
      if (args[0] === 'rev-parse') return args.includes('--abbrev-ref') ? 'master' : sha
      return ''
    }) })
    expect(() => runPreflight({ requireTagAbsent: true }, fail('ls-remote'))).toThrow(/ls-remote/)
    expect(() => runPreflight({}, fail('diff'))).toThrow(/diff/)
  })
})
