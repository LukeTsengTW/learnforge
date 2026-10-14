import { describe, expect, it } from 'vitest'
import { DRAWING_LIMITS, parseStoredDrawing, strokeGeometryPixels } from '../../supabase/functions/_shared/drawing-raster'
import type { DrawingPoint, DrawingStroke } from '../models/drawing'
import { drawingCapacity, drawingUsage, exceededDrawingLimit, ORDINARY_STROKE_POINTS, ORDINARY_STROKE_SEGMENT } from './drawing-capacity'

/**
 * The capacity line and the refusal notices describe the limits of a stored handwriting answer. They
 * are only useful if they agree with the parser that actually accepts or refuses the answer, so every
 * expectation here is checked against parseStoredDrawing.
 */
const config = { width: 1200, height: 900 }
const { maxStrokes, maxPoints, maxGeometryPixels } = DRAWING_LIMITS
const accepted = (strokes: DrawingStroke[]) => {
  try { parseStoredDrawing({ type: 'drawing', strokes }, config); return true } catch { return false }
}
let seed = 20261013
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const pick = (low: number, high: number) => low + Math.floor(random() * (high - low + 1))
const tenth = (value: number) => Math.round(value * 10) / 10
const pen = (points: DrawingPoint[], width = 4): DrawingStroke => ({ tool: 'pen', color: '#202b38', width, points })
const eraser = (points: DrawingPoint[], width = 24): DrawingStroke => ({ tool: 'eraser', color: '#202b38', width, points })
const dot = (x = 600, y = 450) => ({ x, y })
/** A stroke of `count` points that stays on one spot: it uses points and almost no geometry. */
const stationary = (count: number, width = 1) => pen(Array.from({ length: count }, () => dot()), width)
/** A zigzag across the canvas with the eraser: it uses a lot of geometry for its points. */
const scrub = (count: number, width: number, row = 0) => eraser(Array.from({ length: count }, (_, index) =>
  ({ x: index % 2 ? 1100 : 100, y: 100 + ((row * 37 + index * 11) % 700) })), width)
/** The stroke the capacity line keeps room for: few enough points, no long jumps, any brush. */
function ordinaryStroke(width: number, tool: DrawingStroke['tool'], length = pick(1, ORDINARY_STROKE_POINTS)): DrawingStroke {
  let x = random() * config.width, y = random() * config.height
  const points = [{ x: tenth(x), y: tenth(y) }]
  while (points.length < length) {
    const angle = random() * 2 * Math.PI, step = random() < 0.3 ? ORDINARY_STROKE_SEGMENT - 0.2 : random() * (ORDINARY_STROKE_SEGMENT - 0.2)
    x = Math.max(0, Math.min(config.width, x + step * Math.cos(angle)))
    y = Math.max(0, Math.min(config.height, y + step * Math.sin(angle)))
    // Rounding moves a point by at most 0.05 on each axis, which the margin of 0.2 above covers.
    points.push({ x: tenth(x), y: tenth(y) })
  }
  return { tool, color: '#202b38', width, points }
}
const brushes: [DrawingStroke['tool'], number][] = [['pen', 1], ['pen', 4], ['pen', 24], ['eraser', 4], ['eraser', 24], ['eraser', 100]]

describe('which limit refuses a stored drawing', () => {
  it('names the stroke limit one stroke past it, and nothing at the limit', () => {
    const full = Array.from({ length: maxStrokes }, () => pen([dot()]))
    expect(exceededDrawingLimit(full, config)).toBeNull()
    expect(accepted(full)).toBe(true)
    expect(exceededDrawingLimit([...full, pen([dot()])], config)).toBe('strokes')
    expect(accepted([...full, pen([dot()])])).toBe(false)
  })

  it('names the point limit one point past it, and nothing at the limit', () => {
    expect(exceededDrawingLimit([stationary(maxPoints)], config)).toBeNull()
    expect(accepted([stationary(maxPoints)])).toBe(true)
    expect(exceededDrawingLimit([stationary(maxPoints), pen([dot()])], config)).toBe('points')
    expect(accepted([stationary(maxPoints), pen([dot()])])).toBe(false)
  })

  it('names the geometry limit for wide eraser scrubbing that is within the stroke and point limits', () => {
    const scrubs: DrawingStroke[] = []
    while (drawingUsage(scrubs, config).geometryPixels <= maxGeometryPixels) scrubs.push(scrub(40, 100, scrubs.length))
    expect(scrubs.length).toBeLessThanOrEqual(maxStrokes)
    expect(drawingUsage(scrubs, config).points).toBeLessThanOrEqual(maxPoints)
    expect(exceededDrawingLimit(scrubs, config)).toBe('geometry')
    expect(accepted(scrubs)).toBe(false)
    expect(exceededDrawingLimit(scrubs.slice(0, -1), config)).toBeNull()
    expect(accepted(scrubs.slice(0, -1))).toBe(true)
  })

  it('reports the limits in the order the parser checks them: stroke count, then per stroke points before geometry', () => {
    const tooWide: DrawingStroke[] = []
    while (drawingUsage(tooWide, config).geometryPixels <= maxGeometryPixels) tooWide.push(scrub(40, 100, tooWide.length))
    // Geometry is exceeded by an earlier stroke than the one that exceeds the points.
    expect(exceededDrawingLimit([...tooWide, stationary(maxPoints)], config)).toBe('geometry')
    // Points are exceeded by an earlier stroke than the one that exceeds the geometry.
    expect(exceededDrawingLimit([stationary(maxPoints), ...tooWide], config)).toBe('points')
    // The stroke count is checked before any stroke is read.
    expect(exceededDrawingLimit([...Array.from({ length: maxStrokes + 1 }, () => pen([dot()])), stationary(maxPoints)], config)).toBe('strokes')
    // Within one stroke the points are counted before its geometry.
    expect(exceededDrawingLimit([...tooWide.slice(0, -1), scrub(maxPoints, 100)], config)).toBe('points')
  })

  it('agrees with the parser on random drawings around every limit', () => {
    let refused = 0
    for (let round = 0; round < 240; round++) {
      const strokes: DrawingStroke[] = []
      const kind = round % 3
      if (kind === 0) for (let count = pick(maxStrokes - 3, maxStrokes + 3); strokes.length < count;) strokes.push(pen([dot(pick(0, 1200), pick(0, 900))]))
      else if (kind === 1) { strokes.push(stationary(pick(maxPoints - 300, maxPoints - 1))); for (let extra = pick(0, 4); extra > 0; extra--) strokes.push(ordinaryStroke(4, 'pen', pick(1, 150))) }
      else { while (drawingUsage(strokes, config).geometryPixels < maxGeometryPixels * (0.93 + 0.1 * random())) strokes.push(scrub(pick(4, 40), pick(60, 100), strokes.length)) }
      const limit = exceededDrawingLimit(strokes, config)
      expect(limit === null).toBe(accepted(strokes))
      if (limit) refused++
    }
    // Both outcomes occur, so the comparison is not vacuous.
    expect(refused).toBeGreaterThan(40)
    expect(refused).toBeLessThan(200)
  })
})

describe('what a drawing uses of its limits', () => {
  it('counts strokes, points and the same geometry the parser counts', () => {
    const strokes = [pen([{ x: 10, y: 10 }, { x: 30, y: 10 }]), eraser([{ x: 100, y: 100 }], 24), stationary(5)]
    const usage = drawingUsage(strokes, config)
    expect(usage.strokes).toBe(3)
    expect(usage.points).toBe(8)
    expect(usage.geometryPixels).toBe(strokes.reduce((sum, stroke) => sum + strokeGeometryPixels(stroke.points, stroke.width, config), 0))
    // A horizontal 20-unit pen segment of width 4: one box around its first point, one around the segment.
    expect(strokeGeometryPixels(strokes[0].points, 4, config)).toBe(6 * 6 + 26 * 6)
  })
})

describe('capacity line: room for an ordinary stroke', () => {
  /** A drawing whose remaining amount of one limit is exactly `left`, with plenty of the others. */
  const withLeft = {
    strokes: (left: number) => Array.from({ length: maxStrokes - left }, () => pen([dot()], 1)),
    points: (left: number) => [stationary(maxPoints - left)],
    /** Geometry left is `left` to `left + 15`: scrubs, then points worth 10,404 pixels each, then points worth 16. */
    geometry: (left: number) => {
      const strokes: DrawingStroke[] = []
      const target = maxGeometryPixels - left
      const used = () => drawingUsage(strokes, config).geometryPixels
      const scrubPixels = strokeGeometryPixels(scrub(20, 100).points, 100, config)
      while (used() + scrubPixels <= target) strokes.push(scrub(20, 100, 0))
      const coarse = Math.floor((target - used()) / 10404)
      if (coarse > 0) strokes.push(eraser(Array.from({ length: coarse }, () => dot()), 100))
      const fine = Math.floor((target - used()) / 16)
      if (fine > 0) strokes.push(stationary(fine))
      return strokes
    },
  }

  it('is not tight while every limit has room for an ordinary stroke, and tight as soon as one has not', () => {
    for (const [, width] of brushes) {
      const reserve = ORDINARY_STROKE_POINTS * (ORDINARY_STROKE_SEGMENT + width + 4) ** 2
      const roomy = { strokes: maxStrokes - 1, points: maxPoints - ORDINARY_STROKE_POINTS, geometryPixels: maxGeometryPixels - reserve }
      expect(drawingCapacity(roomy, width, null).tight).toBe(false)
      expect(drawingCapacity({ ...roomy, strokes: maxStrokes }, width, null)).toMatchObject({ tight: true, limit: 'strokes' })
      expect(drawingCapacity({ ...roomy, points: roomy.points + 1 }, width, null)).toMatchObject({ tight: true, limit: 'points' })
      expect(drawingCapacity({ ...roomy, geometryPixels: roomy.geometryPixels + 1 }, width, null)).toMatchObject({ tight: true, limit: 'geometry' })
      expect(drawingCapacity(roomy, width, { usedBytes: 4_000_000, maxBytes: 4_194_304 }).tight).toBe(false)
      expect(drawingCapacity(roomy, width, { usedBytes: 4_194_304 - 100, maxBytes: 4_194_304 })).toMatchObject({ tight: true, limit: 'draft' })
    }
  })

  it('reports how full the fullest limit is and which one it is', () => {
    const empty = { strokes: 0, points: 0, geometryPixels: 0 }
    expect(drawingCapacity(empty, 4, null)).toEqual({ fraction: 0, limit: 'strokes', tight: false })
    expect(drawingCapacity({ ...empty, strokes: maxStrokes / 2 }, 4, null)).toMatchObject({ fraction: 0.5, limit: 'strokes', tight: false })
    expect(drawingCapacity({ strokes: maxStrokes / 4, points: maxPoints / 2, geometryPixels: 0 }, 4, null)).toMatchObject({ fraction: 0.5, limit: 'points' })
    expect(drawingCapacity({ ...empty, geometryPixels: maxGeometryPixels * 0.8 }, 4, null)).toMatchObject({ fraction: 0.8, limit: 'geometry' })
    expect(drawingCapacity(empty, 4, { usedBytes: 3, maxBytes: 4 })).toMatchObject({ fraction: 0.75, limit: 'draft' })
  })

  it('a wide eraser needs more room than a pen, so the same drawing can be tight for one and not the other', () => {
    const usage = { strokes: 10, points: 100, geometryPixels: maxGeometryPixels - 2_000_000 }
    expect(drawingCapacity(usage, 4, null).tight).toBe(false)
    expect(drawingCapacity(usage, 100, null)).toMatchObject({ tight: true, limit: 'geometry' })
  })

  it('whenever the line is not tight, the parser accepts an ordinary stroke drawn with that brush', () => {
    let checked = 0
    for (let round = 0; round < 90; round++) {
      const [tool, width] = brushes[round % brushes.length]
      const reserve = ORDINARY_STROKE_POINTS * (ORDINARY_STROKE_SEGMENT + width + 4) ** 2
      // Start exactly at the edge of the reserve of one limit, or a little inside or outside it.
      const nudge = [0, 0, 1, -1][round % 4]
      const base = round % 3 === 0 ? withLeft.strokes(1 + Math.max(0, nudge))
        : round % 3 === 1 ? withLeft.points(ORDINARY_STROKE_POINTS + nudge)
          : withLeft.geometry(reserve + nudge * 40)
      expect(accepted(base)).toBe(true)
      if (drawingCapacity(drawingUsage(base, config), width, null).tight) continue
      // The longest ordinary stroke is the hardest case; shorter ones are drawn as well.
      for (const length of [ORDINARY_STROKE_POINTS, pick(1, ORDINARY_STROKE_POINTS)]) {
        expect(accepted([...base, ordinaryStroke(width, tool, length)])).toBe(true)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(60)
  })

  it('the geometry reserve is an upper bound for the longest ordinary stroke with long steps', () => {
    for (const [tool, width] of brushes) {
      const reserve = ORDINARY_STROKE_POINTS * (ORDINARY_STROKE_SEGMENT + width + 4) ** 2
      for (let round = 0; round < 20; round++) {
        const stroke = ordinaryStroke(width, tool, ORDINARY_STROKE_POINTS)
        expect(strokeGeometryPixels(stroke.points, width, config)).toBeLessThanOrEqual(reserve)
      }
    }
  })
})
