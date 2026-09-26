/// <reference types="node" />
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { DrawingStroke } from '../../models/drawing'
import { DrawingRasterError, DRAWING_LIMITS, encodeDrawingPng, isMeaningfullyNonBlank,
  parseStoredDrawing, rasterDrawingPixels, rasterizeStoredDrawing } from '../../../supabase/functions/_shared/drawing-raster'

const config = { width: 100, height: 100 }
const stroke = (color: DrawingStroke['color'] = '#202b38', width = 4,
  points = [{ x: 10, y: 10 }, { x: 90, y: 10 }]): DrawingStroke => ({ tool: 'pen', color, width, points })
const answer = (strokes: DrawingStroke[]) => ({ type: 'drawing', strokes })
const pixel = (pixels: Uint8Array, x: number, y: number) => [...pixels.subarray((y * config.width + x) * 4, (y * config.width + x) * 4 + 4)]

function decodeRgba(png: Uint8Array) {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const chunks: Uint8Array[] = []
  for (let offset = 8; offset < png.length;) {
    const size = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0)
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8))
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + size))
    offset += size + 12
  }
  const scanlines = inflateSync(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))))
  const decoded = new Uint8Array(config.width * config.height * 4)
  for (let y = 0; y < config.height; y++) {
    expect(scanlines[y * (config.width * 4 + 1)]).toBe(0)
    decoded.set(scanlines.subarray(y * (config.width * 4 + 1) + 1, (y + 1) * (config.width * 4 + 1)), y * config.width * 4)
  }
  return decoded
}

describe('Edge drawing rasterization and PNG', () => {
  it('encodes an opaque white blank canvas', async () => {
    const pixels = rasterDrawingPixels(config, [])
    expect(pixel(pixels, 10, 10)).toEqual([255, 255, 255, 255])
    expect(isMeaningfullyNonBlank(pixels, 100, 100)).toBe(false)
    expect(decodeRgba(await encodeDrawingPng(config, pixels))).toEqual(pixels)
  })
  it.each([
    ['black', '#202b38', [32, 43, 56, 255]],
    ['red', '#c03535', [192, 53, 53, 255]],
    ['blue', '#255bbb', [37, 91, 187, 255]],
  ] as const)('preserves a %s pen stroke in decoded PNG pixels', async (_label, color, expected) => {
    const result = await rasterizeStoredDrawing(answer([stroke(color)]), config)
    expect(pixel(result.pixels, 50, 10)).toEqual(expected)
    expect(pixel(decodeRgba(result.png), 50, 10)).toEqual(expected)
  })
  it('uses logical width and clamps rendering at canvas edges', () => {
    const thin = rasterDrawingPixels(config, [stroke('#202b38', 2, [{ x: 0, y: 0 }, { x: 0, y: 99 }])])
    const thick = rasterDrawingPixels(config, [stroke('#202b38', 12, [{ x: 0, y: 0 }, { x: 0, y: 99 }])])
    expect(pixel(thin, 8, 50)).toEqual([255, 255, 255, 255])
    expect(pixel(thick, 5, 50)[0]).toBeLessThan(255)
    expect(pixel(thick, 99, 50)).toEqual([255, 255, 255, 255])
  })
  it('removes pen ink with destination-out eraser; a fully erased drawing is blank', async () => {
    const pen = stroke('#202b38', 4, [{ x: 10, y: 50 }, { x: 90, y: 50 }])
    const eraser: DrawingStroke = { ...pen, tool: 'eraser', width: 12 }
    const pixels = rasterDrawingPixels(config, [pen, eraser])
    expect(pixel(pixels, 50, 50)).toEqual([255, 255, 255, 255])
    expect(isMeaningfullyNonBlank(pixels, 100, 100)).toBe(false)
    await expect(rasterizeStoredDrawing(answer([pen, eraser]), config)).rejects.toMatchObject({ kind: 'blank' })
  })
  it('uses a deterministic visible coverage threshold for tiny accidental marks', () => {
    const tiny = rasterDrawingPixels(config, [stroke('#202b38', 1, [{ x: 50, y: 50 }])])
    expect(isMeaningfullyNonBlank(tiny, 100, 100)).toBe(false)
    const line = rasterDrawingPixels(config, [stroke()])
    expect(isMeaningfullyNonBlank(line, 100, 100)).toBe(true)
  })
  it('produces deterministic PNG bytes and rejects oversized or malformed saved strokes', async () => {
    const saved = answer([stroke()])
    expect((await rasterizeStoredDrawing(saved, config)).png).toEqual((await rasterizeStoredDrawing(saved, config)).png)
    expect(() => parseStoredDrawing(answer(Array.from({ length: DRAWING_LIMITS.maxStrokes + 1 }, () => stroke())), config))
      .toThrow(DrawingRasterError)
    expect(() => parseStoredDrawing(answer([stroke('#202b38', 4, [{ x: 101, y: 10 }])]), config))
      .toThrow(DrawingRasterError)
    expect(() => parseStoredDrawing(saved, { width: 2000, height: 2000 })).toThrow(DrawingRasterError)
  })
  it('renders the maximum number of short strokes across a large canvas', () => {
    const large = { width: 1200, height: 1200 }
    const dots = Array.from({ length: DRAWING_LIMITS.maxStrokes }, (_, index) => stroke('#202b38', 4,
      [{ x: 20 + (index % 16) * 70, y: 20 + Math.floor(index / 16) * 70 }]))
    const pixels = rasterDrawingPixels(large, parseStoredDrawing(answer(dots), large))
    const red = (x: number, y: number) => pixels[(y * large.width + x) * 4]
    expect(red(20, 20)).toBe(32)
    expect(red(1070, 1070)).toBe(32)
    expect(red(50, 50)).toBe(255)
  })
  it('keeps the AND-gate fixture topology distinct from one missing output connection', () => {
    const gate = [
      stroke('#202b38', 4, [{ x: 35, y: 25 }, { x: 60, y: 25 }, { x: 70, y: 35 }, { x: 70, y: 65 },
        { x: 60, y: 75 }, { x: 35, y: 75 }, { x: 35, y: 25 }]),
      stroke('#202b38', 4, [{ x: 10, y: 38 }, { x: 35, y: 38 }]),
      stroke('#202b38', 4, [{ x: 10, y: 62 }, { x: 35, y: 62 }]),
      stroke('#202b38', 4, [{ x: 70, y: 50 }, { x: 92, y: 50 }]),
    ]
    const correct = rasterDrawingPixels(config, gate)
    const missing = rasterDrawingPixels(config, gate.slice(0, -1))
    expect(pixel(correct, 20, 38)[0]).toBeLessThan(100)
    expect(pixel(correct, 20, 62)[0]).toBeLessThan(100)
    expect(pixel(correct, 85, 50)[0]).toBeLessThan(100)
    expect(pixel(missing, 85, 50)).toEqual([255, 255, 255, 255])
  })
})
