import type { DrawingHistory, DrawingPoint, DrawingStroke } from '../models/drawing'
import type { DrawingConfig } from '../models/quiz'

export interface CanvasRect { left: number; top: number; width: number; height: number }
export function toLogicalPoint(clientX: number, clientY: number, rect: CanvasRect, config: DrawingConfig): DrawingPoint {
  if (rect.width <= 0 || rect.height <= 0 || config.width <= 0 || config.height <= 0) {
    throw new RangeError('Canvas dimensions must be positive.')
  }
  return {
    x: Math.max(0, Math.min(config.width, (clientX - rect.left) * config.width / rect.width)),
    y: Math.max(0, Math.min(config.height, (clientY - rect.top) * config.height / rect.height)),
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

/** Replays logical strokes; erasers remove ink rather than painting white. */
export function replayDrawing(context: CanvasRenderingContext2D, config: DrawingConfig, strokes: readonly DrawingStroke[]): void {
  context.save()
  context.clearRect(0, 0, config.width, config.height)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const stroke of strokes) {
    const first = stroke.points[0]
    if (!first) continue
    context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
    context.strokeStyle = stroke.color
    context.fillStyle = stroke.color
    context.lineWidth = stroke.width
    if (stroke.points.length === 1) {
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
  context.restore()
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
