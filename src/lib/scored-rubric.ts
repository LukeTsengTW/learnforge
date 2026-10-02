import type { CalculationQuestion, DrawingQuestion, Quiz } from '../models/quiz'
import { DRAWING_LIMITS } from '../../supabase/functions/_shared/drawing-raster'
import { isSupportedDrawingConfig } from './calculation-answer'

/** Checks the scored rubric shared by current v3 publishing and legacy advisory controls. */
export function hasScoredRubric(question: CalculationQuestion | DrawingQuestion): boolean {
  return question.rubric.length > 0 && question.rubric.length <= 20
    && question.rubric.every((criterion) => criterion.score !== null && Number.isFinite(criterion.score)
      && criterion.score > 0 && !!criterion.description.trim())
    && Math.abs(question.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0) - question.points) <= 1e-8
}

function commonPublicationErrors(question: CalculationQuestion | DrawingQuestion): string[] {
  const errors: string[] = []
  if (!hasScoredRubric(question)) errors.push(`${question.id}: rubric 必須有正分標準，且總分須等於題目配分。`)
  if (!question.referenceAnswer.trim()) errors.push(`${question.id}: 必須提供 reference answer。`)
  if (!question.solution.trim()) errors.push(`${question.id}: 必須提供 solution。`)
  return errors
}

/** Publication gate for the current v3 revision; historical parsing stays permissive. */
export function validateV3Publication(quiz: Quiz): string[] {
  const errors: string[] = []
  for (const question of quiz.questions) {
    if (question.type !== 'calculation' && question.type !== 'drawing') continue
    errors.push(...commonPublicationErrors(question))
    if (question.type === 'calculation' && question.drawing !== undefined) {
      errors.push(`${question.id}: calculation drawing capability 需要 ai-grading-v4。`)
    }
    if (question.type === 'drawing' && (!Number.isSafeInteger(question.drawing.width)
      || !Number.isSafeInteger(question.drawing.height) || question.drawing.width < 100 || question.drawing.height < 100
      || question.drawing.width > 2000 || question.drawing.height > 2000)) {
      errors.push(`${question.id}: drawing config 的寬高必須介於 100 至 2000。`)
    }
  }
  return errors
}

/** Future v4 publication foundation; current publishing continues to use the v3 gate. */
export function validateV4Publication(quiz: Quiz): string[] {
  const errors: string[] = []
  for (const question of quiz.questions) {
    if (question.type !== 'calculation' && question.type !== 'drawing') continue
    errors.push(...commonPublicationErrors(question))
    if (question.type === 'calculation' && question.drawing === undefined) continue
    if (!isSupportedDrawingConfig(question.drawing)) {
      errors.push(`${question.id}: v4 drawing config 的寬高必須為 100 至 ${DRAWING_LIMITS.maxDimension} 的整數。`)
    }
  }
  return errors
}
