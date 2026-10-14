import { DRAWING_LIMITS, strokeGeometryPixels } from '../../supabase/functions/_shared/drawing-raster.ts'
import type { DrawingStroke } from '../models/drawing'
import type { DrawingConfig } from '../models/quiz'

/** The three limits of one stored handwriting answer, in the order parseStoredDrawing checks them. */
export type DrawingLimit = 'strokes' | 'points' | 'geometry'
/** A limit a stroke can run into: one of the answer's own, or the size of the whole draft. */
export type CapacityLimit = DrawingLimit | 'draft'
export interface DrawingUsage { strokes: number; points: number; geometryPixels: number }

/** What a drawing uses of its limits, counted the way parseStoredDrawing counts. */
export function drawingUsage(strokes: readonly DrawingStroke[], config: DrawingConfig): DrawingUsage {
  let points = 0
  let geometryPixels = 0
  for (const stroke of strokes) {
    points += stroke.points.length
    geometryPixels += strokeGeometryPixels(stroke.points, stroke.width, config)
  }
  return { strokes: strokes.length, points, geometryPixels }
}

/** The limit parseStoredDrawing refuses these strokes for, checked in its order; null when it accepts them. */
export function exceededDrawingLimit(strokes: readonly DrawingStroke[], config: DrawingConfig): DrawingLimit | null {
  if (strokes.length > DRAWING_LIMITS.maxStrokes) return 'strokes'
  let points = 0
  let geometryPixels = 0
  for (const stroke of strokes) {
    points += stroke.points.length
    if (points > DRAWING_LIMITS.maxPoints) return 'points'
    geometryPixels += strokeGeometryPixels(stroke.points, stroke.width, config)
    if (geometryPixels > DRAWING_LIMITS.maxGeometryPixels) return 'geometry'
  }
  return null
}

/**
 * The stroke the capacity hint keeps room for: at most this many stored points, no two consecutive
 * ones farther apart than this. A longer or faster stroke may still be refused while the hint shows
 * room; it is then told which limit refused it.
 */
export const ORDINARY_STROKE_POINTS = 256
export const ORDINARY_STROKE_SEGMENT = 48
/** Draft bytes kept for it: a stored point is at most 24 bytes of JSON and a stroke adds under 150 around its points. */
export const ORDINARY_STROKE_BYTES = ORDINARY_STROKE_POINTS * 40 + 256
/** The hint appears once any limit is this full. */
export const CAPACITY_HINT_FROM = 0.75

export interface DrawingCapacity {
  /** How full the fullest limit is; above 1 only where the owner does not enforce the limits. */
  fraction: number
  /** The limit the hint is about: the first one without room for an ordinary stroke, else the fullest. */
  limit: CapacityLimit
  /** True when some limit no longer has room for an ordinary stroke with the given brush width. */
  tight: boolean
}

/**
 * How close an answer is to its limits. While `tight` is false, a stroke of at most
 * ORDINARY_STROKE_POINTS points whose consecutive points are at most ORDINARY_STROKE_SEGMENT apart,
 * drawn with a brush of `width`, fits every limit.
 */
export function drawingCapacity(usage: DrawingUsage, width: number,
  draft: { usedBytes: number; maxBytes: number } | null): DrawingCapacity {
  // Every point adds the box of one segment: at most the segment length plus the brush and a rounding margin, squared.
  const strokeGeometry = ORDINARY_STROKE_POINTS * (ORDINARY_STROKE_SEGMENT + width + 4) ** 2
  const limits: { limit: CapacityLimit; used: number; max: number; reserve: number }[] = [
    { limit: 'strokes', used: usage.strokes, max: DRAWING_LIMITS.maxStrokes, reserve: 1 },
    { limit: 'points', used: usage.points, max: DRAWING_LIMITS.maxPoints, reserve: ORDINARY_STROKE_POINTS },
    { limit: 'geometry', used: usage.geometryPixels, max: DRAWING_LIMITS.maxGeometryPixels, reserve: strokeGeometry },
    ...(draft ? [{ limit: 'draft' as const, used: draft.usedBytes, max: draft.maxBytes, reserve: ORDINARY_STROKE_BYTES }] : []),
  ]
  const fullest = limits.reduce((a, b) => b.used / b.max > a.used / a.max ? b : a)
  const withoutRoom = limits.find((item) => item.max - item.used < item.reserve)
  return { fraction: fullest.used / fullest.max, limit: (withoutRoom ?? fullest).limit, tight: withoutRoom !== undefined }
}
