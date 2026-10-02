import { DRAWING_LIMITS, parseStoredDrawing } from '../../supabase/functions/_shared/drawing-raster.ts'
import type { CalculationAnswerMode, CalculationAnswerV4, LegacyCalculationAnswer } from '../models/attempt.ts'
import type { DrawingStroke } from '../models/drawing.ts'
import type { CalculationQuestion, DrawingConfig } from '../models/quiz.ts'

export type ActiveCalculationAnswer =
  | { type: 'calculation'; mode: 'text'; text: string }
  | { type: 'calculation'; mode: 'drawing'; strokes: DrawingStroke[] }

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const draftText = (value: unknown): value is string => typeof value === 'string' && value.length <= 100000

/** Recognizes only the legacy shape, never a partial or malformed future answer. */
export function isLegacyCalculationAnswer(value: unknown): value is LegacyCalculationAnswer {
  return record(value) && exactKeys(value, ['type', 'text'])
    && value.type === 'calculation' && draftText(value.text)
}

/** Reuses the server's pure geometry parser; no rasterization or provider work. */
export function isSupportedDrawingConfig(value: unknown): value is DrawingConfig {
  if (!record(value) || !exactKeys(value, ['width', 'height'])
    || typeof value.width !== 'number' || typeof value.height !== 'number') return false
  try {
    parseStoredDrawing({ type: 'drawing', strokes: [] }, { width: value.width, height: value.height })
    return true
  } catch { return false }
}

function validStrokes(value: unknown[], config: DrawingConfig): boolean {
  if (value.length > DRAWING_LIMITS.maxStrokes) return false
  let points = 0
  for (const stroke of value) {
    if (!record(stroke) || !exactKeys(stroke, ['tool', 'color', 'width', 'points'])
      || !Array.isArray(stroke.points) || stroke.points.length === 0) return false
    points += stroke.points.length
    if (points > DRAWING_LIMITS.maxPoints
      || !stroke.points.every((point: unknown) => record(point) && exactKeys(point, ['x', 'y']))) return false
  }
  try {
    // This adapter only validates strokes; the answer and its projection remain calculation.
    parseStoredDrawing({ type: 'drawing', strokes: value }, config)
    return true
  } catch { return false }
}

/** Validates both representations, including inactive geometry, against the exact question. */
export function isCalculationAnswerV4(value: unknown, question: CalculationQuestion): value is CalculationAnswerV4 {
  if (!record(value) || !exactKeys(value, ['type', 'mode', 'text', 'strokes'])
    || value.type !== 'calculation' || (value.mode !== 'text' && value.mode !== 'drawing')
    || !draftText(value.text) || !Array.isArray(value.strokes)) return false
  if (question.drawing === undefined) return value.mode === 'text' && value.strokes.length === 0
  return isSupportedDrawingConfig(question.drawing) && validStrokes(value.strokes, question.drawing)
}

/** Draft-only, in-memory adapter. Callers must keep historical submitted answers unchanged. */
export function normalizeLegacyCalculationDraft(value: unknown): CalculationAnswerV4 | null {
  return isLegacyCalculationAnswer(value)
    ? { type: 'calculation', mode: 'text', text: value.text, strokes: [] }
    : null
}

export function getCalculationActiveMode(value: unknown, question: CalculationQuestion): CalculationAnswerMode | null {
  if (isLegacyCalculationAnswer(value)) return 'text'
  return isCalculationAnswerV4(value, question) ? value.mode : null
}

/** Semantic input only; authoritative hash encoding belongs to the future database milestone. */
export function projectActiveCalculationAnswer(value: unknown, question: CalculationQuestion): ActiveCalculationAnswer | null {
  if (isLegacyCalculationAnswer(value)) return { type: 'calculation', mode: 'text', text: value.text }
  if (!isCalculationAnswerV4(value, question)) return null
  if (value.mode === 'text') return { type: 'calculation', mode: 'text', text: value.text }
  return { type: 'calculation', mode: 'drawing',
    strokes: value.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })) }
}
