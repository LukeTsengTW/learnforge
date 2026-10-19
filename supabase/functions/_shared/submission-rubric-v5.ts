import { canonicalizeSubmissionRubricV4, isCanonicalSubmissionRubricContextV4,
  isCanonicalSubmissionRubricV4 } from './submission-rubric-v4.ts'
import type { TutorQuestionContext } from './ai-tutor.ts'
import type { SubmissionRubricOutput, SubmissionRubricQuestionType } from './submission-rubric.ts'

/** v5 keeps the canonical eight-decimal scoring contract while using distinct answer identities. */
export const isCanonicalSubmissionRubricContextV5 = isCanonicalSubmissionRubricContextV4

export function canonicalizeSubmissionRubricV5(output: unknown, question: TutorQuestionContext,
  type: SubmissionRubricQuestionType): SubmissionRubricOutput | null {
  return canonicalizeSubmissionRubricV4(output, question, type)
}

export function isCanonicalSubmissionRubricV5(output: SubmissionRubricOutput, question: TutorQuestionContext,
  type: SubmissionRubricQuestionType): boolean {
  return isCanonicalSubmissionRubricV4(output, question, type)
}
