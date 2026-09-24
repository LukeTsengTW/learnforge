export const DRAWING_COLORS = ['#202b38', '#c03535', '#255bbb'] as const
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
