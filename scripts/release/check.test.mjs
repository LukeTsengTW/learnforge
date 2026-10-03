import { describe, expect, it } from 'vitest'
import { executeGates } from './check.mjs'

describe('fail-closed local release gate runner', () => {
  it('runs all fixed gates in order on success', () => {
    const visited = []
    const result = executeGates([
      { name: 'lint', run: () => { visited.push('lint'); return { status: 0 } } },
      { name: 'test', run: () => { visited.push('test'); return { status: 0, stdout: 'Tests  543 passed (543)' } } },
      { name: 'build', run: () => { visited.push('build'); return { status: 0 } } },
    ])
    expect(visited).toEqual(['lint', 'test', 'build'])
    expect(result.test).toEqual({ status: 'passed', exitCode: 0, testCount: 543 })
  })
  it('stops on a failed gate and never runs subsequent gates', () => {
    let later = false
    const result = executeGates([
      { name: 'lint', run: () => ({ status: 1 }) },
      { name: 'build', run: () => { later = true; return { status: 0 } } },
    ])
    expect(result.lint).toEqual({ status: 'failed', exitCode: 1 })
    expect(result.build).toEqual({ status: 'not-run', exitCode: null })
    expect(later).toBe(false)
  })
  it('treats thrown exceptions and missing exit codes as failures', () => {
    for (const run of [() => { throw new Error('private diagnostics') }, () => ({ status: null })]) {
      const result = executeGates([{ name: 'lint', run }])
      expect(result.lint.status).toBe('failed')
      expect(JSON.stringify(result)).not.toContain('private diagnostics')
    }
  })
})
