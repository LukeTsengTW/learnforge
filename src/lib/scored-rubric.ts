import type { CalculationQuestion, DrawingQuestion } from '../models/quiz'

/** Matches the availability gate used by manual-question AI controls. */
export function hasScoredRubric(question: CalculationQuestion | DrawingQuestion): boolean {
  return question.rubric.length > 0
    && question.rubric.every((criterion) => criterion.score !== null && Number.isFinite(criterion.score)
      && criterion.score > 0 && !!criterion.description.trim())
    && Math.abs(question.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0) - question.points) <= 1e-8
}
