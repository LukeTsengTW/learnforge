export const GRADING_VERSION = {
  deterministicV1: 'deterministic-v1',
  semanticFillV2: 'semantic-fill-v2',
  aiGradingV3: 'ai-grading-v3',
} as const

export type GradingVersion = typeof GRADING_VERSION[keyof typeof GRADING_VERSION]
