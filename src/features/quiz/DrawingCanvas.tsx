import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { DRAWING_COLORS, type DrawingColor, type DrawingStroke, type DrawingTool } from '../../models/drawing'
import type { DrawingConfig } from '../../models/quiz'
import { downloadDrawingPng, drawingReducer, replayDrawing, toLogicalPoint, type DrawingAction } from '../../lib/drawing'

interface DrawingCanvasProps {
  id: string
  config: DrawingConfig
  strokes: DrawingStroke[]
  onChange: (strokes: DrawingStroke[]) => void
}
const COLOR_LABELS = ['黑色', '紅色', '藍色']

export function DrawingCanvas({ id, config, strokes, onChange }: DrawingCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const pending = useRef<{ pointerId: number; stroke: DrawingStroke } | null>(null)
  const [undone, setUndone] = useState<DrawingStroke[]>([])
  const history = { strokes, undone }
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState<DrawingColor>(DRAWING_COLORS[0])
  const [width, setWidth] = useState(4)
  const [status, setStatus] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const paint = (ink: DrawingStroke[]) => {
    const context = canvas.current?.getContext('2d')
    if (context) replayDrawing(context, config, ink)
  }
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (context) replayDrawing(context, config, strokes)
  }, [config, strokes])

  function changeDrawing(action: DrawingAction) {
    const next = drawingReducer(history, action)
    setUndone(next.undone)
    onChange(next.strokes)
    setConfirmClear(false)
    if (action.type !== 'add') setStatus(action.type === 'clear' ? '畫布已清除。' : action.type === 'undo' ? '已復原上一筆。' : '已重做一筆。')
  }
  function point(event: PointerEvent<HTMLCanvasElement>) {
    return toLogicalPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), config)
  }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || !event.isPrimary || pending.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pending.current = { pointerId: event.pointerId, stroke: { tool, color, width, points: [point(event)] } }
    paint([...history.strokes, pending.current.stroke])
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const active = pending.current
    if (!active || active.pointerId !== event.pointerId) return
    event.preventDefault()
    active.stroke.points.push(point(event))
    paint([...history.strokes, active.stroke])
  }
  function finish(event: PointerEvent<HTMLCanvasElement>) {
    const active = pending.current
    if (!active || active.pointerId !== event.pointerId) return
    if (event.type === 'pointerup') active.stroke.points.push(point(event))
    pending.current = null
    changeDrawing({ type: 'add', stroke: active.stroke })
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  async function exportPng() {
    try { await downloadDrawingPng(config, history.strokes, `${id}.png`); setStatus('PNG 已匯出。') }
    catch { setStatus('PNG 匯出失敗，請重試。') }
  }

  return <div className="drawing-editor">
    <div className="drawing-toolbar" role="group" aria-label="畫布工具">
      <div className="tool-group">
        <button type="button" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>畫筆</button>
        <button type="button" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>橡皮擦</button>
      </div>
      <div className="tool-group" role="group" aria-label="畫筆顏色">
        {DRAWING_COLORS.map((item, index) => <button key={item} type="button" className="color-button"
          aria-label={COLOR_LABELS[index]} title={COLOR_LABELS[index]} aria-pressed={color === item}
          onClick={() => { setColor(item); setTool('pen') }}>
          <span style={{ backgroundColor: item }} aria-hidden="true" />
          {color === item && <span className="color-check" aria-hidden="true">✓</span>}
        </button>)}
      </div>
      <label className="brush-label" htmlFor={`${id}-width`}>筆寬 <output>{width}</output>
        <input id={`${id}-width`} type="range" min="1" max="24" value={width} onChange={(event) => setWidth(Number(event.target.value))} />
      </label>
      <div className="tool-group">
        <button type="button" disabled={!history.strokes.length} onClick={() => changeDrawing({ type: 'undo' })}>復原</button>
        <button type="button" disabled={!history.undone.length} onClick={() => changeDrawing({ type: 'redo' })}>重做</button>
      </div>
    </div>
    <div className="canvas-frame">
      <canvas ref={canvas} width={config.width} height={config.height} className="drawing-canvas"
        aria-label="繪圖作答區" aria-describedby={`${id}-instructions`} role="img"
        onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
        你的瀏覽器不支援 Canvas。請使用新版瀏覽器繪圖。
      </canvas>
    </div>
    <div className="drawing-bottom"><p id={`${id}-instructions`}>使用滑鼠、手指或觸控筆繪圖。工具可用鍵盤操作。</p>
      <div className="inline-actions">
        <button className="text-button" type="button" disabled={!history.strokes.length} onClick={() => setConfirmClear(true)}>清除畫布</button>
        <button className="text-button" type="button" onClick={exportPng}>匯出 PNG</button>
      </div>
    </div>
    {confirmClear && <div className="notice warning" role="alert"><p>清除所有筆畫後無法復原。</p>
      <div className="inline-actions"><button type="button" onClick={() => changeDrawing({ type: 'clear' })}>確認清除</button>
        <button type="button" onClick={() => setConfirmClear(false)}>保留畫布</button></div></div>}
    <p className="drawing-status" role="status">{status}</p>
  </div>
}
