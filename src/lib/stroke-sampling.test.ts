import { describe, expect, it } from 'vitest'
import type { DrawingPoint } from '../models/drawing'
import { appendStrokeSample, STROKE_SAMPLE_MAX_RUN, STROKE_SAMPLE_MAX_SEGMENT, STROKE_SAMPLE_TOLERANCE } from './stroke-sampling'

/** Feeds samples the way DrawingCanvas does: the first is the pointerdown, the rest go through the sampler. */
function sampled(raw: DrawingPoint[]) {
  const points = [raw[0]]
  const run: DrawingPoint[] = []
  const snapshots: DrawingPoint[][] = []
  let longestRun = 0
  for (const point of raw.slice(1)) {
    appendStrokeSample(points, run, point)
    snapshots.push([...points])
    longestRun = Math.max(longestRun, run.length)
  }
  return { points, snapshots, longestRun }
}
function distanceToSegment(point: DrawingPoint, from: DrawingPoint, to: DrawingPoint) {
  const dx = to.x - from.x, dy = to.y - from.y, span = dx * dx + dy * dy
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / span))
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy))
}
/** Largest distance from any raw sample to the stored polyline. */
function deviation(raw: DrawingPoint[], stored: DrawingPoint[]) {
  return Math.max(...raw.map((point) => Math.min(...stored.slice(1).map((to, index) => distanceToSegment(point, stored[index], to)))))
}
const segments = (points: DrawingPoint[]) => points.slice(1).map((to, index) => Math.hypot(to.x - points[index].x, to.y - points[index].y))
const row = (count: number, step: number, y = 50) => Array.from({ length: count }, (_, index) => ({ x: 10 + index * step, y }))
/** Deterministic pseudo-random numbers in [0, 1). */
function generator(seed: number) {
  let state = seed
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 }
}

describe('stroke sampling', () => {
  it('stores the down and up samples of a tap', () => {
    const tap = { x: 30, y: 40 }
    expect(sampled([tap, { ...tap }]).points).toEqual([tap, tap])
  })

  it('replaces dense samples on a straight line by its two ends', () => {
    const raw = row(21, 1) // 20 units long, one sample per unit
    expect(sampled(raw).points).toEqual([raw[0], raw[20]])
  })

  it('stores samples that arrive farther apart than the maximum segment as received', () => {
    const raw = row(6, STROKE_SAMPLE_MAX_SEGMENT + 1) // collinear, but sparse
    expect(sampled(raw).points).toEqual(raw)
  })

  it('never lets a segment that stands in for other samples exceed the maximum segment', () => {
    const raw = row(401, 0.5) // 200 units long
    const { points } = sampled(raw)
    expect(points[0]).toEqual(raw[0])
    expect(points.at(-1)).toEqual(raw.at(-1))
    expect(Math.max(...segments(points))).toBeLessThanOrEqual(STROKE_SAMPLE_MAX_SEGMENT)
    expect(points.length).toBe(Math.ceil(200 / STROKE_SAMPLE_MAX_SEGMENT) + 1)
  })

  it('keeps the turning point of a stroke that doubles back along itself', () => {
    const out = row(11, 1), back = row(6, 1).map((point) => ({ x: 20 - (point.x - 10) - 1, y: point.y })) // to x=20, back to x=14
    const { points } = sampled([...out, ...back])
    expect(points).toEqual([{ x: 10, y: 50 }, { x: 20, y: 50 }, { x: 14, y: 50 }])
  })

  it('keeps a sharp corner exactly', () => {
    const across = row(11, 1, 0), down = Array.from({ length: 10 }, (_, index) => ({ x: 20, y: index + 1 }))
    const { points } = sampled([...across, ...down])
    expect(points).toEqual([{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }])
  })

  it('always ends the stroke at the latest sample, so a commit at any moment stores what is painted', () => {
    const raw = Array.from({ length: 120 }, (_, index) => ({ x: 100 + 30 * Math.cos(index / 15), y: 100 + 30 * Math.sin(index / 15) }))
    sampled(raw).snapshots.forEach((points, index) => expect(points.at(-1)).toBe(raw[index + 1]))
  })

  it('stores only samples it received, in order, and none twice', () => {
    const raw = Array.from({ length: 200 }, (_, index) => ({ x: 50 + index * 0.8, y: 80 + 12 * Math.sin(index / 9) }))
    const { points } = sampled(raw)
    const positions = points.map((point) => raw.indexOf(point))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(new Set(positions).size).toBe(positions.length)
  })

  it('keeps every sample that is not stored within the tolerance of the stored stroke, at every moment', () => {
    const random = generator(20261012)
    for (let stroke = 0; stroke < 60; stroke++) {
      // A wandering path: small steps whose direction drifts, with occasional pauses and sharp turns.
      let x = 200 + random() * 400, y = 150 + random() * 300, heading = random() * Math.PI * 2
      const raw = [{ x, y }]
      for (let index = 0; index < 250; index++) {
        heading += (random() - 0.5) * (random() < 0.05 ? 3 : 0.5)
        const step = random() < 0.1 ? 0 : random() * 3
        x += Math.cos(heading) * step + (random() - 0.5) * 0.2
        y += Math.sin(heading) * step + (random() - 0.5) * 0.2
        raw.push({ x, y })
      }
      const { points, snapshots } = sampled(raw)
      expect(points.length).toBeLessThan(raw.length)
      for (const index of [0, 1, 2, 10, 60, 125, 248, 249]) {
        expect(deviation(raw.slice(0, index + 2), snapshots[index])).toBeLessThanOrEqual(STROKE_SAMPLE_TOLERANCE + 1e-9)
      }
    }
  })

  it('reduces a densely sampled curve to a fraction of its samples', () => {
    const raw = Array.from({ length: 252 }, (_, index) => ({ x: 300 + 20 * Math.cos(index / 20), y: 300 + 20 * Math.sin(index / 20) })) // two turns, 1 unit apart
    const { points } = sampled(raw)
    expect(points.length).toBeLessThan(raw.length / 4)
    expect(deviation(raw, points)).toBeLessThanOrEqual(STROKE_SAMPLE_TOLERANCE + 1e-9)
  })

  it('bounds the work per sample while the pen rests, at the cost of a few stored points', () => {
    const random = generator(7)
    const raw = Array.from({ length: 1000 }, () => ({ x: 400 + (random() - 0.5) * 0.3, y: 300 + (random() - 0.5) * 0.3 }))
    const { points, longestRun } = sampled(raw)
    expect(longestRun).toBeLessThanOrEqual(STROKE_SAMPLE_MAX_RUN)
    expect(points.length).toBeLessThanOrEqual(Math.ceil(1000 / STROKE_SAMPLE_MAX_RUN) + 2)
  })
})
