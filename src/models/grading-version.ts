export const GRADING_VERSION = {
  deterministicV1: 'deterministic-v1',
  semanticFillV2: 'semantic-fill-v2',
  aiGradingV3: 'ai-grading-v3',
  aiGradingV4: 'ai-grading-v4',
} as const

export type GradingVersion = typeof GRADING_VERSION[keyof typeof GRADING_VERSION]

/** Official server rubric grading: calculation and drawing contribute to the practice score. */
export const isOfficialRubricVersion = (gradingVersion: string | undefined): boolean =>
  gradingVersion === GRADING_VERSION.aiGradingV3 || gradingVersion === GRADING_VERSION.aiGradingV4
