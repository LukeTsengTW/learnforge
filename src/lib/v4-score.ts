/**
 * ai-grading-v4 score precision contract: every score is a finite decimal with at most 8
 * fractional digits. Rounding is defined on the IEEE-754 value via Number#toFixed (exact
 * nearest, ties to the larger value) and happens only on the server Edge before persistence.
 * PostgreSQL never rounds v4 scores; private.v4_score_is_canonical only verifies them, so
 * exact NUMERIC sums of canonical criteria equal the canonical total. Not applied to v3.
 */
export const V4_SCORE_DECIMALS = 8

export function canonicalV4Score(value: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const canonical = Number(value.toFixed(V4_SCORE_DECIMALS))
  return canonical === 0 ? 0 : canonical
}

export function isCanonicalV4Score(value: unknown): value is number {
  return typeof value === 'number' && canonicalV4Score(value) === value && !Object.is(value, -0)
}

/**
 * The single v4 server rubric context invariant (submit preflight, evidence canonicalization and
 * v4 publication): canonical positive points, canonical positive criteria, and a canonical criterion
 * total EXACTLY equal to the points, matching the exact NUMERIC check in the v4 SQL finalizer.
 * Server-authored values are only verified, never rounded or rewritten.
 */
export function isCanonicalV4RubricContext(points: unknown, criterionPoints: readonly unknown[] | undefined): boolean {
  if (!isCanonicalV4Score(points) || points <= 0 || !Array.isArray(criterionPoints) || criterionPoints.length === 0
    || !criterionPoints.every((value) => isCanonicalV4Score(value) && value > 0)) return false
  return canonicalV4Score((criterionPoints as number[]).reduce((sum, value) => sum + value, 0)) === points
}
