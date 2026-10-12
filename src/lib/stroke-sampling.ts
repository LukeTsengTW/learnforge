import type { DrawingPoint } from '../models/drawing'

/**
 * Largest distance, in logical canvas units, between a pointer sample that is not stored and the
 * stored polyline. Half a unit is half a pixel of the bitmap that is shown, saved and rasterized.
 */
export const STROKE_SAMPLE_TOLERANCE = 0.5
/**
 * Longest stored segment that may stand in for samples that were not stored. Samples that arrive
 * farther apart than this are stored as received, so only dense sampling is reduced.
 */
export const STROKE_SAMPLE_MAX_SEGMENT = 24
/** Bounds the work per pointer event; a longer run simply stores one more point. */
export const STROKE_SAMPLE_MAX_RUN = 128

function distanceToSegment(point: DrawingPoint, from: DrawingPoint, to: DrawingPoint): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const span = dx * dx + dy * dy
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / span))
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy))
}

/**
 * Adds one pointer sample to a stroke in progress.
 *
 * `points` is the stroke as it is painted and as it would be stored right now: the points kept so
 * far followed by the latest sample. `run` holds the samples received since the last kept point.
 * A run is replaced by the single segment from that point to the latest sample for as long as
 * every sample of the run stays within the tolerance of the segment; the first sample that breaks
 * this makes the previous one a kept point. Distances are to the segment, not the infinite line,
 * so a stroke that doubles back keeps its turning point.
 */
export function appendStrokeSample(points: DrawingPoint[], run: DrawingPoint[], sample: DrawingPoint): void {
  const anchor = points[points.length - 2]
  if (anchor && run.length > 0 && run.length < STROKE_SAMPLE_MAX_RUN
    && Math.hypot(sample.x - anchor.x, sample.y - anchor.y) <= STROKE_SAMPLE_MAX_SEGMENT
    && run.every((previous) => distanceToSegment(previous, anchor, sample) <= STROKE_SAMPLE_TOLERANCE)) {
    points[points.length - 1] = sample
    run.push(sample)
    return
  }
  points.push(sample)
  run.length = 0
  run.push(sample)
}
