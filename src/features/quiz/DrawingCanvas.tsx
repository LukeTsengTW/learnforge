import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent, type Ref } from 'react'
import { DRAWING_COLORS, type DrawingColor, type DrawingStroke, type DrawingTool } from '../../models/drawing'
import type { DrawingConfig } from '../../models/quiz'
import { downloadDrawingPng, drawingReducer, replayDrawing, toLogicalPoint, type DrawingAction } from '../../lib/drawing'
import { getDrawingInputMode, saveDrawingInputMode, type DrawingInputMode } from '../../lib/drawing-input-mode'

interface DrawingCanvasProps {
  id: string
  config: DrawingConfig
  strokes: DrawingStroke[]
  onChange: (strokes: DrawingStroke[]) => void
  ref?: Ref<DrawingCanvasHandle>
}
export interface DrawingCanvasHandle {
  /** Commit visible pending ink and return the strokes for a combined controlled update. */
  flushPendingStroke: () => DrawingStroke[]
}
const COLOR_LABELS = ['黑色', '紅色', '藍色']

export function DrawingCanvas({ id, config, strokes, onChange, ref }: DrawingCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const pending = useRef<{ pointerId: number; stroke: DrawingStroke } | null>(null)
  // Local commits must accumulate before a controlled parent acknowledges them.
  const committed = useRef(strokes)
  const [ink, setInk] = useState({ controlled: strokes, strokes })
  if (ink.controlled !== strokes) setInk({ controlled: strokes, strokes })
  const [undone, setUndone] = useState<DrawingStroke[]>([])
  const history = { strokes: ink.strokes, undone }
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState<DrawingColor>(DRAWING_COLORS[0])
  const [width, setWidth] = useState(4)
  const [status, setStatus] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [inputMode, setInputMode] = useState<DrawingInputMode>(getDrawingInputMode)

  const paint = (ink: DrawingStroke[]) => {
    const context = canvas.current?.getContext('2d')
    if (context) replayDrawing(context, config, ink)
  }
  useLayoutEffect(() => {
    // A new controlled value remains authoritative, including replacement/clear.
    committed.current = strokes
  }, [strokes])
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    const active = pending.current
    if (context) replayDrawing(context, config, active ? [...committed.current, active.stroke] : committed.current)
  }, [config, strokes])

  function changeDrawing(action: DrawingAction) {
    const next = drawingReducer({ strokes: committed.current, undone }, action)
    committed.current = next.strokes
    setInk({ controlled: strokes, strokes: next.strokes })
    setUndone(next.undone)
    paint(next.strokes)
    onChange(next.strokes)
    setConfirmClear(false)
    if (action.type !== 'add') setStatus(action.type === 'clear' ? '畫布已清除。' : action.type === 'undo' ? '已復原上一筆。' : '已重做一筆。')
    return next.strokes
  }
  function point(event: PointerEvent<HTMLCanvasElement>) {
    return toLogicalPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), config)
  }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    // Reject touch before it can own pending ink or capture, including primary palms.
    if (inputMode === 'stylus' && event.pointerType === 'touch') return
    if (event.button !== 0 || !event.isPrimary || pending.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pending.current = { pointerId: event.pointerId, stroke: { tool, color, width, points: [point(event)] } }
    paint([...committed.current, pending.current.stroke])
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const active = pending.current
    if (!active || active.pointerId !== event.pointerId) return
    event.preventDefault()
    active.stroke.points.push(point(event))
    paint([...committed.current, active.stroke])
  }
  function finish(event: PointerEvent<HTMLCanvasElement>) {
    const active = pending.current
    if (!active || active.pointerId !== event.pointerId) return
    active.stroke.points.push(point(event))
    commitPendingStroke()
  }
  function cancel(event: PointerEvent<HTMLCanvasElement>) {
    if (pending.current?.pointerId === event.pointerId) commitPendingStroke()
  }
  function lostCapture(event: PointerEvent<HTMLCanvasElement>) {
    // A delayed loss from the previous contact can reuse the current pointerId.
    // hasPointerCapture reflects the new capture immediately after pointerdown.
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) cancel(event)
  }
  function commitPendingStroke() {
    const active = pending.current
    if (!active) return committed.current
    pending.current = null
    const next = changeDrawing({ type: 'add', stroke: active.stroke })
    return next
  }
  function flushPendingStroke() {
    const active = pending.current
    const next = commitPendingStroke()
    const element = canvas.current
    // Only imperative flush needs explicit release; up/cancel release implicitly.
    if (active && element?.hasPointerCapture(active.pointerId)) element.releasePointerCapture(active.pointerId)
    return next
  }
  useImperativeHandle(ref, () => ({ flushPendingStroke }))
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
      <label className="drawing-input-label" htmlFor={`${id}-input-mode`}>輸入方式
        <select id={`${id}-input-mode`} value={inputMode} aria-describedby={`${id}-instructions`}
          onChange={(event) => {
            const mode: DrawingInputMode = event.target.value === 'stylus' ? 'stylus' : 'standard'
            setInputMode(mode)
            saveDrawingInputMode(mode)
          }}>
          <option value="standard">標準</option>
          <option value="stylus">觸控筆優先</option>
        </select>
      </label>
    </div>
    <div className="canvas-frame">
      <canvas ref={canvas} width={config.width} height={config.height} className="drawing-canvas"
        aria-label="繪圖作答區" aria-describedby={`${id}-instructions`} role="img"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={lostCapture}>
        你的瀏覽器不支援 Canvas。請使用新版瀏覽器繪圖。
      </canvas>
    </div>
    <div className="drawing-bottom"><p id={`${id}-instructions`}>
      <span>{inputMode === 'stylus' ? '已忽略手指與手掌觸控；請使用觸控筆或滑鼠繪圖。' : '滑鼠、手指與觸控筆皆可繪圖'}</span>
      {' '}工具可用鍵盤操作。
    </p>
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
