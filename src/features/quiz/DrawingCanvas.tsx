import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent, type Ref } from 'react'
import { DRAWING_COLORS, type DrawingColor, type DrawingStroke, type DrawingTool } from '../../models/drawing'
import type { DrawingConfig } from '../../models/quiz'
import { isIPadOS } from '../../lib/platform'
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
  const showPencilNotice = isIPadOS(navigator)
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
  const [penWidth, setPenWidth] = useState(4)
  const [eraserWidth, setEraserWidth] = useState(24)
  const width = tool === 'eraser' ? eraserWidth : penWidth
  const widthLabel = tool === 'eraser' ? '橡皮擦大小' : '筆寬'
  // UI only: a contact snapshots its width; hover follows the eraser slider.
  const [eraserPreview, setEraserPreview] = useState<{ pointerId: number; x: number; y: number; width?: number } | null>(null)
  const previewWidth = eraserPreview?.width ?? eraserWidth
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
  function hidePreview(event: PointerEvent<HTMLCanvasElement>) {
    setEraserPreview(current => current?.pointerId === event.pointerId ? null : current)
  }
  function updatePreview(event: PointerEvent<HTMLCanvasElement>, strokeWidth?: number) {
    if (tool !== 'eraser' || !event.isPrimary || (inputMode === 'stylus' && event.pointerType === 'touch')) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0
      || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      hidePreview(event)
      return
    }
    setEraserPreview({ pointerId: event.pointerId, ...toLogicalPoint(event.clientX, event.clientY, rect, config), width: strokeWidth })
  }
  function hover(event: PointerEvent<HTMLCanvasElement>) {
    if (!pending.current && (event.pointerType === 'mouse' || event.pointerType === 'pen')) updatePreview(event)
  }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    // Reject touch before it can own pending ink or capture, including primary palms.
    if (inputMode === 'stylus' && event.pointerType === 'touch') return
    if (event.button !== 0 || !event.isPrimary || pending.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pending.current = { pointerId: event.pointerId, stroke: { tool, color, width, points: [point(event)] } }
    paint([...committed.current, pending.current.stroke])
    if (tool === 'eraser') updatePreview(event, eraserWidth)
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const active = pending.current
    if (!active) { hover(event); return }
    if (active.pointerId !== event.pointerId) return
    event.preventDefault()
    active.stroke.points.push(point(event))
    paint([...committed.current, active.stroke])
    if (active.stroke.tool === 'eraser') updatePreview(event, active.stroke.width)
  }
  function finish(event: PointerEvent<HTMLCanvasElement>) {
    const active = pending.current
    if (!active || active.pointerId !== event.pointerId) return
    active.stroke.points.push(point(event))
    commitPendingStroke()
    // Mouse release remains a hover, using the current size rather than the finished stroke's snapshot.
    if (event.pointerType === 'mouse') updatePreview(event)
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
    setEraserPreview(null)
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
        <button type="button" aria-pressed={tool === 'pen'} onClick={() => { setTool('pen'); setEraserPreview(null) }}>畫筆</button>
        <button type="button" aria-pressed={tool === 'eraser'} onClick={() => { setTool('eraser'); setEraserPreview(null) }}>橡皮擦</button>
      </div>
      <div className="tool-group" role="group" aria-label="畫筆顏色">
        {DRAWING_COLORS.map((item, index) => <button key={item} type="button" className="color-button"
          aria-label={COLOR_LABELS[index]} title={COLOR_LABELS[index]} aria-pressed={color === item}
          onClick={() => { setColor(item); setTool('pen'); setEraserPreview(null) }}>
          <span style={{ backgroundColor: item }} aria-hidden="true" />
          {color === item && <span className="color-check" aria-hidden="true">✓</span>}
        </button>)}
      </div>
      <label className="brush-label" htmlFor={`${id}-width`}><span id={`${id}-width-label`}>{widthLabel}</span>
        <output htmlFor={`${id}-width`}>{width}</output>
        <input id={`${id}-width`} type="range" aria-labelledby={`${id}-width-label`}
          min={tool === 'eraser' ? 4 : 1} max={tool === 'eraser' ? 40 : 24} step="1" value={width}
          onChange={(event) => (tool === 'eraser' ? setEraserWidth : setPenWidth)(Number(event.target.value))} />
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
            setEraserPreview(null)
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
        onPointerEnter={hover} onPointerLeave={hidePreview}
        onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={lostCapture}>
        你的瀏覽器不支援 Canvas。請使用新版瀏覽器繪圖。
      </canvas>
      {tool === 'eraser' && eraserPreview && <div className="eraser-preview" aria-hidden="true" style={{
        // Percentages project logical coordinates onto the canvas's responsive
        // display rect and keep scaling even when no new pointer event arrives.
        left: `${eraserPreview.x / config.width * 100}%`, top: `${eraserPreview.y / config.height * 100}%`,
        width: `${previewWidth / config.width * 100}%`, height: `${previewWidth / config.height * 100}%`,
      }} />}
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
    {showPencilNotice && <aside role="note" aria-label="Apple Pencil 使用提醒" className="drawing-compatibility">
      <strong>Apple Pencil 使用提醒</strong>
      <p>若使用 Apple Pencil 時出現快速抬筆後下一筆無法立即書寫的情況，請前往「設定」→「Apple Pencil」關閉「隨手寫」。</p>
      <a href="https://support.apple.com/zh-tw/guide/ipad/ipad355ab2a7/ipados" target="_blank" rel="noopener noreferrer">查看 Apple 官方設定說明</a>
    </aside>}
    {confirmClear && <div className="notice warning" role="alert"><p>清除所有筆畫後無法復原。</p>
      <div className="inline-actions"><button type="button" onClick={() => changeDrawing({ type: 'clear' })}>確認清除</button>
        <button type="button" onClick={() => setConfirmClear(false)}>保留畫布</button></div></div>}
    <p className="drawing-status" role="status">{status}</p>
  </div>
}
