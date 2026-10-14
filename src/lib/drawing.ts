import type { DrawingHistory, DrawingPoint, DrawingStroke } from '../models/drawing'
import type { DrawingConfig } from '../models/quiz'

export interface CanvasRect { left: number; top: number; width: number; height: number }
/**
 * Pointer positions are kept to a tenth of a logical unit: far below one pixel of the bitmap that is
 * shown, saved and rasterized, and about half the JSON of an unrounded coordinate.
 */
export const DRAWING_COORDINATE_STEPS_PER_UNIT = 10
const snap = (value: number) => Math.round(value * DRAWING_COORDINATE_STEPS_PER_UNIT) / DRAWING_COORDINATE_STEPS_PER_UNIT
export function toLogicalPoint(clientX: number, clientY: number, rect: CanvasRect, config: DrawingConfig): DrawingPoint {
  if (rect.width <= 0 || rect.height <= 0 || config.width <= 0 || config.height <= 0) {
    throw new RangeError('Canvas dimensions must be positive.')
  }
  // Clamp first: the canvas size is an integer, so a snapped point never leaves it.
  return {
    x: snap(Math.max(0, Math.min(config.width, (clientX - rect.left) * config.width / rect.width))),
    y: snap(Math.max(0, Math.min(config.height, (clientY - rect.top) * config.height / rect.height))),
  }
}

export type DrawingAction = { type: 'add'; stroke: DrawingStroke } | { type: 'undo' } | { type: 'redo' } | { type: 'clear' }
export function drawingReducer(history: DrawingHistory, action: DrawingAction): DrawingHistory {
  switch (action.type) {
    case 'add': return action.stroke.points.length
      ? { strokes: [...history.strokes, structuredClone(action.stroke)], undone: [] } : history
    case 'undo': {
      const stroke = history.strokes.at(-1)
      return stroke ? { strokes: history.strokes.slice(0, -1), undone: [...history.undone, stroke] } : history
    }
    case 'redo': {
      const stroke = history.undone.at(-1)
      return stroke ? { strokes: [...history.strokes, stroke], undone: history.undone.slice(0, -1) } : history
    }
    case 'clear': return { strokes: [], undone: [] }
  }
}

/** One stroke on top of what the context already holds; erasers remove ink rather than painting white. */
function paintStroke(context: CanvasRenderingContext2D, stroke: DrawingStroke): void {
  const first = stroke.points[0]
  if (!first) return
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  context.strokeStyle = stroke.color
  context.fillStyle = stroke.color
  context.lineWidth = stroke.width
  const hasDisplacement = stroke.points.some(point => point.x !== first.x || point.y !== first.y)
  if (!hasDisplacement) {
    context.beginPath()
    context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2)
    context.fill()
  } else {
    context.beginPath()
    context.moveTo(first.x, first.y)
    for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y)
    context.stroke()
  }
}

/** Replays logical strokes; erasers remove ink rather than painting white. */
export function replayDrawing(context: CanvasRenderingContext2D, config: DrawingConfig, strokes: readonly DrawingStroke[]): void {
  context.save()
  context.clearRect(0, 0, config.width, config.height)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const stroke of strokes) paintStroke(context, stroke)
  context.restore()
}

/**
 * While a stroke is drawn, every pointer move repaints the canvas. Replaying all finished strokes
 * takes longer the more there are, and a handler slower than a frame makes the browser merge pointer
 * moves, so the stored stroke would lose samples. The finished strokes are therefore kept as one
 * offscreen bitmap, and a move paints that bitmap plus the stroke in progress. One bitmap serves the
 * whole page, because only one stroke is in progress at a time. At rest a canvas is always a full replay.
 */
const inkLayer: { canvas: HTMLCanvasElement | null; source: HTMLCanvasElement | null; strokes: readonly DrawingStroke[] | null } =
  { canvas: null, source: null, strokes: null }

/** The offscreen context, or null when it cannot stand in for a replay onto `visible`. */
function inkLayerContext(visible: CanvasRenderingContext2D, config: DrawingConfig): CanvasRenderingContext2D | null {
  if (typeof visible.drawImage !== 'function') return null
  inkLayer.canvas ??= document.createElement('canvas')
  const context = inkLayer.canvas.getContext('2d')
  // A context that is also the visible one (test doubles hand out a single context) cannot hold a copy.
  if (!context || context === visible) return null
  if (inkLayer.canvas.width !== config.width || inkLayer.canvas.height !== config.height) {
    inkLayer.canvas.width = config.width
    inkLayer.canvas.height = config.height
    inkLayer.source = null
  }
  return context
}

/** True when the bitmap was last taken from this canvas, i.e. this is the canvas being written on. */
export function holdsInkOf(source: HTMLCanvasElement): boolean {
  return inkLayer.source === source
}

/** Call right after `source` was fully replayed with `strokes`: keeps a copy for the next stroke to start from. */
export function rememberInk(source: HTMLCanvasElement, config: DrawingConfig, strokes: readonly DrawingStroke[]): void {
  try {
    const visible = source.getContext('2d')
    const context = visible && inkLayerContext(visible, config)
    if (!context) return
    context.clearRect(0, 0, config.width, config.height)
    context.drawImage(source, 0, 0)
    inkLayer.source = source
    inkLayer.strokes = strokes
  } catch { inkLayer.source = null }
}

/**
 * Paints `strokes` followed by the stroke in progress, pixel for pixel what replayDrawing paints for
 * [...strokes, pending], without replaying the finished strokes on every call. Falls back to that
 * replay whenever the bitmap cannot be used; it never throws for lack of it.
 */
export function paintInProgress(context: CanvasRenderingContext2D, source: HTMLCanvasElement, config: DrawingConfig,
  strokes: readonly DrawingStroke[], pending: DrawingStroke): void {
  try {
    const layer = inkLayerContext(context, config)
    if (layer && inkLayer.canvas) {
      if (inkLayer.source !== source || inkLayer.strokes !== strokes) {
        inkLayer.source = null
        replayDrawing(layer, config, strokes)
        inkLayer.source = source
        inkLayer.strokes = strokes
      }
      context.save()
      try {
        context.clearRect(0, 0, config.width, config.height)
        context.globalCompositeOperation = 'source-over'
        context.drawImage(inkLayer.canvas, 0, 0)
        context.lineCap = 'round'
        context.lineJoin = 'round'
        paintStroke(context, pending)
      } finally { context.restore() }
      return
    }
  } catch { inkLayer.source = null }
  replayDrawing(context, config, [...strokes, pending])
}

/** Local-only PNG export at logical resolution with an opaque white background. */
export async function exportDrawingPng(config: DrawingConfig, strokes: readonly DrawingStroke[]): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = config.width
  canvas.height = config.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('此瀏覽器無法匯出 Canvas。')
  replayDrawing(context, config, strokes)
  context.globalCompositeOperation = 'destination-over'
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('PNG 匯出失敗。')), 'image/png',
  ))
}

export async function downloadDrawingPng(config: DrawingConfig, strokes: readonly DrawingStroke[], filename: string): Promise<void> {
  const url = URL.createObjectURL(await exportDrawingPng(config, strokes))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Allow the browser to start the download before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
