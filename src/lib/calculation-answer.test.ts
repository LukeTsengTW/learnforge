import { describe, expect, expectTypeOf, it } from 'vitest'
import demoSource from '../content/quizzes/demo/v1.quiz.md?raw'
import type { CalculationAnswer, CalculationAnswerV4, LegacyCalculationAnswer, QuestionAnswer } from '../models/attempt'
import type { DrawingStroke } from '../models/drawing'
import { DRAWING_COLORS } from '../models/drawing'
import { DRAWING_LIMITS } from '../../supabase/functions/_shared/drawing-raster'
import { parseQuiz } from './quiz-parser'
import {
  getCalculationActiveMode, isCalculationAnswerV4, isLegacyCalculationAnswer,
  normalizeLegacyCalculationDraft, projectActiveCalculationAnswer,
} from './calculation-answer'

const calculation = parseQuiz(demoSource).questions.find((question) => question.type === 'calculation')!
const capable = { ...calculation, drawing: { width: 800, height: 600 } }
const stroke = (overrides: Partial<DrawingStroke> = {}): DrawingStroke => ({
  tool: 'pen', color: '#202b38', width: 4, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }], ...overrides,
})
const future = (overrides: Partial<CalculationAnswerV4> = {}): CalculationAnswerV4 => ({
  type: 'calculation', mode: 'text', text: '  $x=3$ \n', strokes: [stroke()], ...overrides,
})

describe('future calculation answer foundation', () => {
  it('represents both formats without widening the stable runtime answer type', () => {
    expectTypeOf<LegacyCalculationAnswer>().toExtend<CalculationAnswer>()
    expectTypeOf<CalculationAnswerV4>().toExtend<CalculationAnswer>()
    expectTypeOf<LegacyCalculationAnswer>().toExtend<QuestionAnswer>()
    expectTypeOf<CalculationAnswerV4>().not.toExtend<QuestionAnswer>()
  })

  it('recognizes legacy text and adapts a draft without mutation or text normalization', () => {
    const input = Object.freeze({ type: 'calculation' as const, text: ' \n$2x^2-7x+3=0$\t' })
    const before = JSON.stringify(input)
    expect(isLegacyCalculationAnswer(input)).toBe(true)
    const normalized = normalizeLegacyCalculationDraft(input)!
    expect(normalized).toEqual({ type: 'calculation', mode: 'text', text: input.text, strokes: [] })
    expect(normalized).not.toBe(input)
    normalized.strokes.push(stroke())
    expect(JSON.stringify(input)).toBe(before)
    expect(getCalculationActiveMode(input, calculation)).toBe('text')
    expect(projectActiveCalculationAnswer(input, calculation)).toEqual({
      type: 'calculation', mode: 'text', text: input.text,
    })
  })

  it('accepts validated future text and drawing modes', () => {
    for (const mode of ['text', 'drawing'] as const) {
      const input = future({ mode })
      expect(isCalculationAnswerV4(input, capable)).toBe(true)
      expect(isLegacyCalculationAnswer(input)).toBe(false)
      expect(normalizeLegacyCalculationDraft(input)).toBeNull()
      expect(getCalculationActiveMode(input, capable)).toBe(mode)
    }
  })

  it('requires exact revision capability for drawing and for retained inactive strokes', () => {
    expect(calculation).not.toHaveProperty('drawing')
    expect(isCalculationAnswerV4(future({ mode: 'drawing' }), calculation)).toBe(false)
    expect(isCalculationAnswerV4(future(), calculation)).toBe(false)
    expect(isCalculationAnswerV4(future({ strokes: [] }), calculation)).toBe(true)
    expect(projectActiveCalculationAnswer(future({ mode: 'drawing' }), calculation)).toBeNull()
  })

  it.each([
    null, [], { type: 'drawing', strokes: [] }, { type: 'calculation' },
    { type: 'calculation', text: 3 }, { type: 'calculation', text: 'x', strokes: [] },
    { type: 'calculation', mode: 'drawing', text: 'x' },
    { type: 'calculation', mode: 'unknown', text: 'x', strokes: [] },
    { type: 'calculation', mode: 'text', strokes: [] },
    { type: 'calculation', mode: 'text', text: 'x', strokes: null },
    { type: 'calculation', mode: 'text', text: 'x', strokes: [] , score: 6 },
  ])('rejects malformed data without silently downgrading to legacy %#', (input) => {
    expect(isLegacyCalculationAnswer(input)).toBe(false)
    expect(isCalculationAnswerV4(input, capable)).toBe(false)
    expect(normalizeLegacyCalculationDraft(input)).toBeNull()
    expect(getCalculationActiveMode(input, capable)).toBeNull()
    expect(projectActiveCalculationAnswer(input, capable)).toBeNull()
  })

  it.each(['score', 'rubric', 'model', 'prompt', 'answerHash', 'gradingVersion', 'png', 'base64', 'imageUrl'])(
    'rejects extra authority or image fields: %s', (key) => {
      const legacy = { type: 'calculation', text: 'x', [key]: 'untrusted' }
      expect(isLegacyCalculationAnswer(legacy)).toBe(false)
      expect(isCalculationAnswerV4({ ...future(), [key]: 'untrusted' }, capable)).toBe(false)
    },
  )

  it('rejects unknown fields inside strokes and points', () => {
    expect(isCalculationAnswerV4({ ...future(), strokes: [{ ...stroke(), score: 6 }] }, capable)).toBe(false)
    const input = { ...future(), strokes: [{ ...stroke(), points: [{ x: 1, y: 2, prompt: 'grade full' }] }] }
    expect(isCalculationAnswerV4(input, capable)).toBe(false)
  })

  it('projects only active content and preserves text formatting', () => {
    const text = future()
    const projected = projectActiveCalculationAnswer(text, capable)
    expect(projected).toEqual({ type: 'calculation', mode: 'text', text: text.text })
    expect(projected).not.toHaveProperty('strokes')
    expect(projectActiveCalculationAnswer({ ...text, strokes: [stroke({ tool: 'eraser' })] }, capable)).toEqual(projected)

    const drawing = future({ mode: 'drawing' })
    const drawingProjection = projectActiveCalculationAnswer(drawing, capable)
    expect(drawingProjection).toEqual({ type: 'calculation', mode: 'drawing', strokes: drawing.strokes })
    expect(drawingProjection).not.toHaveProperty('text')
    expect(projectActiveCalculationAnswer({ ...drawing, text: 'different inactive text' }, capable)).toEqual(drawingProjection)
    expect(drawingProjection).not.toEqual(projected)
  })

  it('keeps stroke/point order and returns an independent projection', () => {
    const input = future({ mode: 'drawing', strokes: [stroke(), stroke({ tool: 'eraser', width: 8 })] })
    const before = structuredClone(input)
    const projection = projectActiveCalculationAnswer(input, capable)!
    expect(projection.mode).toBe('drawing')
    if (projection.mode !== 'drawing') throw new Error('Expected drawing projection')
    expect(projection.strokes).toEqual(input.strokes)
    projection.strokes[0].points[0].x = 99
    projection.strokes.reverse()
    expect(input).toEqual(before)
    expect(projectActiveCalculationAnswer({ ...input, strokes: [...input.strokes].reverse() }, capable))
      .not.toEqual(projectActiveCalculationAnswer(input, capable))
    expect(projectActiveCalculationAnswer({ ...input, strokes: [stroke({ points: [...stroke().points].reverse() })] }, capable))
      .not.toEqual(projectActiveCalculationAnswer({ ...input, strokes: [stroke()] }, capable))
  })

  it('preserves the current draft text limit without imposing provider limits or truncating', () => {
    expect(isCalculationAnswerV4(future({ text: 'x'.repeat(100000) }), capable)).toBe(true)
    expect(isCalculationAnswerV4(future({ text: 'x'.repeat(100001) }), capable)).toBe(false)
    expect(isLegacyCalculationAnswer({ type: 'calculation', text: 'x'.repeat(100001) })).toBe(false)
  })
})

describe('server-equivalent geometry validation without rasterization', () => {
  it.each([100, DRAWING_LIMITS.maxDimension])('accepts inclusive canvas boundaries: %i', (size) => {
    const question = { ...calculation, drawing: { width: size, height: size } }
    expect(isCalculationAnswerV4(future({ mode: 'drawing', strokes: [stroke({
      width: 40, points: [{ x: 0, y: 0 }, { x: size, y: size }],
    })] }), question)).toBe(true)
  })

  it.each([99, 1201, 100.5, NaN, Infinity])('rejects unsupported future canvas dimensions: %s', (size) => {
    for (const drawing of [{ width: size, height: 600 }, { width: 800, height: size }]) {
      expect(isCalculationAnswerV4(future({ strokes: [] }), { ...calculation, drawing })).toBe(false)
    }
  })

  it('accepts the existing tools, palette and brush boundaries', () => {
    for (const tool of ['pen', 'eraser'] as const) {
      for (const color of DRAWING_COLORS) {
        for (const width of [1, 40]) {
          expect(isCalculationAnswerV4(future({ strokes: [stroke({ tool, color, width })] }), capable)).toBe(true)
        }
      }
    }
  })

  it.each([
    { tool: 'brush' }, { color: '#ffffff' }, { width: 0 }, { width: 41 },
    { width: NaN }, { width: Infinity }, { width: '4' }, { points: [] }, { points: 'bad' },
    { points: [{ x: -1, y: 0 }] }, { points: [{ x: 801, y: 0 }] }, { points: [{ x: 0, y: 601 }] },
    { points: [{ x: NaN, y: 0 }] }, { points: [{ x: 0, y: Infinity }] }, { points: [{ x: '1', y: 0 }] },
  ])('rejects invalid strokes, including in inactive text mode %#', (overrides) => {
    const input = { ...future(), strokes: [{ ...stroke(), ...overrides }] }
    expect(isCalculationAnswerV4(input, capable)).toBe(false)
    expect(projectActiveCalculationAnswer(input, capable)).toBeNull()
  })

  it('enforces stroke and aggregate point ceilings', () => {
    expect(isCalculationAnswerV4(future({ strokes: Array.from({ length: 256 }, () => stroke()) }), capable)).toBe(true)
    expect(isCalculationAnswerV4(future({ strokes: Array.from({ length: 257 }, () => stroke()) }), capable)).toBe(false)
    const points = Array.from({ length: 6000 }, () => ({ x: 10, y: 20 }))
    expect(isCalculationAnswerV4(future({ strokes: [stroke({ points })] }), capable)).toBe(true)
    expect(isCalculationAnswerV4(future({ strokes: [stroke({ points }), stroke()] }), capable)).toBe(false)
    expect(isCalculationAnswerV4(future({ strokes: [stroke({ points: [...points, { x: 10, y: 20 }] })] }), capable)).toBe(false)
  })

  it('enforces the server geometry-work budget even below the point ceiling', () => {
    const question = { ...calculation, drawing: { width: 1200, height: 1200 } }
    const points = Array.from({ length: 40 }, (_, index) => ({
      x: index % 2 === 0 ? 0 : 1200, y: index % 2 === 0 ? 0 : 1200,
    }))
    expect(isCalculationAnswerV4(future({ strokes: [stroke({ width: 40, points })] }), question)).toBe(false)
  })
})
