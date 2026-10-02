import { canonicalV4Score, isCanonicalV4RubricContext } from '../../../src/lib/v4-score.ts'
import type { TutorQuestionContext } from './ai-tutor.ts'
import { validateSubmissionRubricOutput, type SubmissionRubricOutput,
  type SubmissionRubricQuestionType } from './submission-rubric.ts'

/** Server-owned v4 rubric context: the shared v4 invariant applied to an exact-revision question. */
export function isCanonicalSubmissionRubricContextV4(question: TutorQuestionContext): boolean {
  return (question.type === 'calculation' || question.type === 'drawing')
    && isCanonicalV4RubricContext(question.points, question.gradingRubric?.map((criterion) => criterion.points))
}

/**
 * ai-grading-v4 adapter around the shared strict validator. Criterion awards are canonicalized
 * to the v4 precision, statuses are re-checked AFTER canonicalization, and the authoritative
 * total is recomputed from canonical criteria. The provider's own score is accepted only when it
 * canonicalizes to that same total. Historical v3 output is never passed through this adapter.
 */
export function canonicalizeSubmissionRubricV4(output: unknown, question: TutorQuestionContext,
  type: SubmissionRubricQuestionType): SubmissionRubricOutput | null {
  const validated = validateSubmissionRubricOutput(output, question, type)
  const rubric = question.gradingRubric
  if (!validated || !rubric || !isCanonicalSubmissionRubricContextV4(question)) return null
  let total = 0
  const criteria: SubmissionRubricOutput['criteria'] = []
  for (let index = 0; index < rubric.length; index++) {
    const criterion = validated.criteria[index]
    const maxScore = rubric[index].points
    const awardedScore = canonicalV4Score(criterion.awardedScore)
    if (awardedScore === null || awardedScore < 0 || awardedScore > maxScore
      || (criterion.status === 'full' && awardedScore !== maxScore)
      || (criterion.status === 'partial' && !(awardedScore > 0 && awardedScore < maxScore))
      || (criterion.status === 'none' && awardedScore !== 0)) return null
    total += awardedScore
    criteria.push({ ...criterion, awardedScore, maxScore })
  }
  const score = canonicalV4Score(total)
  if (score === null || score < 0 || score > question.points! || validated.maxScore !== question.points
    || canonicalV4Score(validated.score) !== score) return null
  return { ...validated, score, maxScore: question.points!, criteria }
}

/** Cached/persisted v4 evidence must already be in canonical form; it is never re-rounded on read. */
export function isCanonicalSubmissionRubricV4(output: SubmissionRubricOutput, question: TutorQuestionContext,
  type: SubmissionRubricQuestionType): boolean {
  const canonical = canonicalizeSubmissionRubricV4(output, question, type)
  return !!canonical && JSON.stringify(canonical) === JSON.stringify(output)
}
