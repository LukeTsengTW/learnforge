import { describe, expect, it } from 'vitest'
import { validateSha, validateVersion, parseArgs } from './common.mjs'

describe('release identity and arguments', () => {
  it('accepts an exact stable package version', () => {
    expect(validateVersion('1.3.0')).toBe('1.3.0')
  })
  it.each(['v1.3.0', '01.3.0', '1.3', '1.3.0-beta', '1.3.0+build', '1.3.0\n', '1.3.0\r', '1.3.0\u2028', '', undefined])('rejects invalid release version %s', value => {
    expect(() => validateVersion(value)).toThrow()
  })
  it('accepts a complete lowercase SHA', () => {
    expect(validateSha('2dfa0fdf0f97000830fa0d456105ca456f0d1df5')).toBe('2dfa0fdf0f97000830fa0d456105ca456f0d1df5')
  })
  it.each(['2dfa0fd', 'A'.repeat(40), 'g'.repeat(40), 'a'.repeat(40) + '\n', '--help', undefined])('rejects non-exact SHA %s', value => {
    expect(() => validateSha(value)).toThrow()
  })
  it('parses only declared flags and string values', () => {
    expect(parseArgs(['--base', 'v1.3.0', '--require-clean'], { base: 'string', 'require-clean': 'boolean' }))
      .toEqual({ base: 'v1.3.0', 'require-clean': true })
  })
  it.each([['--unknown'], ['--base'], ['--base', '--require-clean'], ['--base', 'HEAD', '--base', 'master'], ['HEAD'], ['--require-clean=false']])('rejects ambiguous arguments %j', (...args) => {
    expect(() => parseArgs(args, { base: 'string', 'require-clean': 'boolean' })).toThrow()
  })
})
