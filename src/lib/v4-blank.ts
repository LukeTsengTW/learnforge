/**
 * ai-grading-v4 blank classification contract, mirrored by private.v4_is_blank_text in the
 * M4 migration. Classification only: stored answer text is never trimmed or rewritten, and
 * historical v3 blank semantics are unchanged.
 */
export const V4_BLANK_CODE_POINTS: readonly number[] = Object.freeze([
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
])
const BLANK = new Set(V4_BLANK_CODE_POINTS)

export function isV4BlankText(text: string): boolean {
  for (const character of text) if (!BLANK.has(character.codePointAt(0)!)) return false
  return true
}
