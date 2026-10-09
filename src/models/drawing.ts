export const DRAWING_COLORS = ['#202b38', '#c03535', '#255bbb'] as const
export const DRAWING_PEN_WIDTH_MIN = 1
export const DRAWING_PEN_WIDTH_MAX = 24
export const DRAWING_ERASER_WIDTH_MIN = 4
export const DRAWING_ERASER_WIDTH_MAX = 100
// Stored strokes retain historical widths, including erasers below the UI minimum.
export const DRAWING_STORED_WIDTH_MIN = DRAWING_PEN_WIDTH_MIN
export const DRAWING_STORED_WIDTH_MAX = DRAWING_ERASER_WIDTH_MAX
export type DrawingColor = typeof DRAWING_COLORS[number]
export type DrawingTool = 'pen' | 'eraser'
export interface DrawingPoint { x: number; y: number }
export interface DrawingStroke {
  tool: DrawingTool
  color: DrawingColor
  width: number
  points: DrawingPoint[]
}
export interface DrawingHistory { strokes: DrawingStroke[]; undone: DrawingStroke[] }
