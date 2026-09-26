import { DRAWING_COLORS, type DrawingStroke } from '../../../src/models/drawing.ts'
import type { DrawingConfig } from '../../../src/models/quiz.ts'

// The browser canvas and this Edge rasterizer use the same logical coordinates,
// round caps/joins, source-over pen, and destination-out eraser semantics.
export const DRAWING_LIMITS = {
  maxDimension: 1200,
  maxStrokes: 256,
  maxPoints: 6000,
  maxGeometryPixels: 25_000_000,
  maxPngBytes: 2_000_000,
} as const

export class DrawingRasterError extends Error {
  readonly kind: 'invalid' | 'oversized' | 'blank'
  constructor(kind: 'invalid' | 'oversized' | 'blank') { super(kind); this.kind = kind }
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function parseStoredDrawing(raw: unknown, config: DrawingConfig): DrawingStroke[] {
  if (!Number.isInteger(config.width) || !Number.isInteger(config.height)
    || config.width < 100 || config.height < 100) throw new DrawingRasterError('invalid')
  if (config.width > DRAWING_LIMITS.maxDimension || config.height > DRAWING_LIMITS.maxDimension) {
    throw new DrawingRasterError('oversized')
  }
  if (!record(raw) || raw.type !== 'drawing' || !Array.isArray(raw.strokes)) {
    throw new DrawingRasterError('invalid')
  }
  if (raw.strokes.length > DRAWING_LIMITS.maxStrokes) throw new DrawingRasterError('oversized')
  let pointCount = 0
  let geometryPixels = 0
  const strokes: DrawingStroke[] = []
  for (const value of raw.strokes) {
    if (!record(value) || (value.tool !== 'pen' && value.tool !== 'eraser')
      || !DRAWING_COLORS.some((color) => color === value.color)
      || !finite(value.width) || value.width < 1 || value.width > 40
      || !Array.isArray(value.points) || value.points.length === 0) throw new DrawingRasterError('invalid')
    pointCount += value.points.length
    if (pointCount > DRAWING_LIMITS.maxPoints) throw new DrawingRasterError('oversized')
    const points = value.points.map((point: unknown) => {
      if (!record(point) || !finite(point.x) || !finite(point.y)
        || point.x < 0 || point.x > config.width || point.y < 0 || point.y > config.height) {
        throw new DrawingRasterError('invalid')
      }
      return { x: clamp(point.x, 0, config.width), y: clamp(point.y, 0, config.height) }
    })
    const radius = value.width / 2 + 1
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)]
      const b = points[i]
      const x0 = clamp(Math.floor(Math.min(a.x, b.x) - radius), 0, config.width)
      const x1 = clamp(Math.ceil(Math.max(a.x, b.x) + radius), 0, config.width)
      const y0 = clamp(Math.floor(Math.min(a.y, b.y) - radius), 0, config.height)
      const y1 = clamp(Math.ceil(Math.max(a.y, b.y) + radius), 0, config.height)
      geometryPixels += (x1 - x0) * (y1 - y0)
      if (geometryPixels > DRAWING_LIMITS.maxGeometryPixels) throw new DrawingRasterError('oversized')
    }
    strokes.push({ tool: value.tool, color: value.color as DrawingStroke['color'], width: value.width, points })
  }
  return strokes
}

function distanceSquared(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax; const dy = by - ay
  const length2 = dx * dx + dy * dy
  const t = length2 ? clamp(((px - ax) * dx + (py - ay) * dy) / length2, 0, 1) : 0
  const x = px - ax - t * dx; const y = py - ay - t * dy
  return x * x + y * y
}

function paintSegment(coverage: Uint8Array, stamps: Uint16Array, touched: Uint32Array,
  stamp: number, touchedCount: number, config: DrawingConfig, a: DrawingStroke['points'][number],
  b: DrawingStroke['points'][number], radius: number): number {
  const { width, height } = config
  const x0 = clamp(Math.floor(Math.min(a.x, b.x) - radius - 1), 0, width)
  const x1 = clamp(Math.ceil(Math.max(a.x, b.x) + radius + 1), 0, width)
  const y0 = clamp(Math.floor(Math.min(a.y, b.y) - radius - 1), 0, height)
  const y1 = clamp(Math.ceil(Math.max(a.y, b.y) + radius + 1), 0, height)
  const r2 = radius * radius
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let mask = 0
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      if (distanceSquared(x + (sx ? 0.75 : 0.25), y + (sy ? 0.75 : 0.25),
        a.x, a.y, b.x, b.y) <= r2) mask |= 1 << (sy * 2 + sx)
    }
    if (!mask) continue
    const index = y * width + x
    if (stamps[index] !== stamp) {
      stamps[index] = stamp
      coverage[index] = mask
      touched[touchedCount++] = index
    } else coverage[index] |= mask
  }
  return touchedCount
}

/** Premultiplied ink alpha preserves destination-out even when later pen strokes overlap. */
export function rasterDrawingPixels(config: DrawingConfig, strokes: readonly DrawingStroke[]): Uint8Array {
  const { width, height } = config
  const ink = new Uint8Array(width * height * 4)
  const coverage = new Uint8Array(width * height)
  // Per-stroke stamps keep short strokes from scanning the entire canvas.
  const stamps = new Uint16Array(width * height)
  const touched = new Uint32Array(width * height)
  for (let strokeIndex = 0; strokeIndex < strokes.length; strokeIndex++) {
    const stroke = strokes[strokeIndex]
    const stamp = strokeIndex + 1
    let touchedCount = 0
    const radius = stroke.width / 2
    for (let i = 0; i < stroke.points.length; i++) {
      touchedCount = paintSegment(coverage, stamps, touched, stamp, touchedCount, config,
        stroke.points[Math.max(0, i - 1)], stroke.points[i], radius)
    }
    const color = [1, 3, 5].map((start) => Number.parseInt(stroke.color.slice(start, start + 2), 16))
    for (let j = 0; j < touchedCount; j++) {
      const i = touched[j]
      const mask = coverage[i]
      const fraction = ((mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1)) / 4
      if (!fraction) continue
      const offset = i * 4
      const keep = 1 - fraction
      for (let channel = 0; channel < 3; channel++) {
        ink[offset + channel] = Math.round(ink[offset + channel] * keep
          + (stroke.tool === 'pen' ? color[channel] * fraction : 0))
      }
      ink[offset + 3] = Math.round(ink[offset + 3] * keep
        + (stroke.tool === 'pen' ? 255 * fraction : 0))
    }
  }
  const pixels = new Uint8Array(ink.length)
  for (let i = 0; i < ink.length; i += 4) {
    const background = 255 - ink[i + 3]
    pixels[i] = Math.min(255, ink[i] + background)
    pixels[i + 1] = Math.min(255, ink[i + 1] + background)
    pixels[i + 2] = Math.min(255, ink[i + 2] + background)
    pixels[i + 3] = 255
  }
  return pixels
}

/** Availability check only; it does not score or classify diagram correctness. */
export function isMeaningfullyNonBlank(pixels: Uint8Array, width: number, height: number): boolean {
  let visible = 0
  const threshold = Math.max(12, Math.ceil(width * height * 0.00002))
  for (let i = 0; i < pixels.length; i += 4) {
    if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 245 && ++visible >= threshold) return true
  }
  return false
}

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
function u32(value: number) { return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]) }
function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}
function crc32(bytes: Uint8Array) {
  let crc = -1
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ -1) >>> 0
}
function chunk(name: string, data: Uint8Array) {
  const body = concat([new TextEncoder().encode(name), data])
  return concat([u32(data.length), body, u32(crc32(body))])
}

/** PNG encoding uses only Web APIs available in Deno Edge: CompressionStream and typed arrays. */
export async function encodeDrawingPng(config: DrawingConfig, pixels: Uint8Array): Promise<Uint8Array> {
  const { width, height } = config
  if (pixels.length !== width * height * 4) throw new DrawingRasterError('invalid')
  const rows = new Uint8Array(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) rows.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1)
  const compressor = new CompressionStream('deflate')
  const result = new Response(compressor.readable).arrayBuffer()
  const writer = compressor.writable.getWriter()
  await writer.write(rows)
  await writer.close()
  const compressed = new Uint8Array(await result)
  const header = concat([u32(width), u32(height), new Uint8Array([8, 6, 0, 0, 0])])
  const png = concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', compressed), chunk('IEND', new Uint8Array())])
  if (png.length > DRAWING_LIMITS.maxPngBytes) throw new DrawingRasterError('oversized')
  return png
}

export async function rasterizeStoredDrawing(raw: unknown, config: DrawingConfig) {
  const strokes = parseStoredDrawing(raw, config)
  const pixels = rasterDrawingPixels(config, strokes)
  if (!isMeaningfullyNonBlank(pixels, config.width, config.height)) throw new DrawingRasterError('blank')
  return { png: await encodeDrawingPng(config, pixels), pixels }
}
