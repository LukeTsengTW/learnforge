import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { V4_BLANK_CODE_POINTS, isV4BlankText } from './v4-blank'

const migration = readFileSync(new URL('../../supabase/migrations/20261002024103_ai_grading_v4_multimodal_submission.sql',
  import.meta.url), 'utf8')
// The exact SQL fixtures in supabase/tests/security.sql use these same code-point lists.
const REQUIRED = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
  0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff]
const NOT_BLANK = [0x85, 0x180e, 0x200b, 0x200c, 0x200d, 0x2060, 0x41, 0x3042]

function sqlBlankSet(): number[] {
  const body = /create function private\.v4_is_blank_text[\s\S]*?btrim\(p_text, U&'([^']*)'\)/.exec(migration)?.[1]
  if (!body) throw new Error('v4 blank SQL literal not found')
  return [...body.matchAll(/\\([0-9A-Fa-f]{4})/g)].map((match) => Number.parseInt(match[1], 16))
}

describe('ai-grading-v4 blank classification contract', () => {
  it('declares exactly the required code points', () => {
    expect([...V4_BLANK_CODE_POINTS].sort((a, b) => a - b)).toEqual(REQUIRED)
  })

  it('matches the PostgreSQL private.v4_is_blank_text character set exactly', () => {
    expect(sqlBlankSet().sort((a, b) => a - b)).toEqual(REQUIRED)
  })

  it.each(REQUIRED)('classifies U+%s as blank alone and composed', (codePoint) => {
    const character = String.fromCodePoint(codePoint)
    expect(isV4BlankText(character)).toBe(true)
    expect(isV4BlankText(`${character} ${character}`)).toBe(true)
  })

  it.each(NOT_BLANK)('does not classify U+%s as blank', (codePoint) => {
    expect(isV4BlankText(String.fromCodePoint(codePoint))).toBe(false)
  })

  it('treats empty as blank and any visible character as nonblank without rewriting text', () => {
    const text = '　x '
    expect(isV4BlankText('')).toBe(true)
    expect(isV4BlankText(text)).toBe(false)
    expect(text).toBe('　x ')
  })

  it('agrees with the JavaScript trim set on every fixture (no TS/SQL drift for v4)', () => {
    for (const codePoint of [...REQUIRED, ...NOT_BLANK]) {
      const character = String.fromCodePoint(codePoint)
      expect(isV4BlankText(character)).toBe(character.trim() === '')
    }
  })
})
