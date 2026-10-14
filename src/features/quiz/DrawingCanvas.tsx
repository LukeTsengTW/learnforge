import { useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type Ref } from 'react'
import { DRAWING_COLORS, DRAWING_ERASER_WIDTH_MIN, DRAWING_ERASER_WIDTH_MAX,
  DRAWING_PEN_WIDTH_MIN, DRAWING_PEN_WIDTH_MAX, type DrawingColor, type DrawingPoint, type DrawingStroke, type DrawingTool } from '../../models/drawing'
import type { DrawingConfig } from '../../models/quiz'
import { isIPadOS } from '../../lib/platform'
import { downloadDrawingPng, drawingReducer, holdsInkOf, paintInProgress, rememberInk, replayDrawing, toLogicalPoint,
  type DrawingAction } from '../../lib/drawing'
import { CAPACITY_HINT_FROM, drawingCapacity, drawingUsage, exceededDrawingLimit, type CapacityLimit,
  type DrawingCapacity, type DrawingUsage } from '../../lib/drawing-capacity'
import { appendStrokeSample } from '../../lib/stroke-sampling'
import { getDrawingInputMode, saveDrawingInputMode, type DrawingInputMode } from '../../lib/drawing-input-mode'
import { DRAWING_LIMITS } from '../../../supabase/functions/_shared/drawing-raster.ts'
import { DraftCapacityContext, type AnswerOutcome } from './attempt-context'

interface DrawingCanvasProps {
  id: string
  config: DrawingConfig
  strokes: DrawingStroke[]
  /** Synchronous: a result other than 'accepted' (or no result) means the owner did not take the change. */
  onChange: (strokes: DrawingStroke[]) => AnswerOutcome | void
  ref?: Ref<DrawingCanvasHandle>
}
const UNDO_OR_CLEAR = '請先復原或清除部分筆畫再繼續。'
const count = (value: number) => value.toLocaleString('en-US')
/** Why a stroke was not added, by the limit that refused it; 'other' when the owner names none of them. */
export const DRAWING_LIMIT_NOTICES: Record<CapacityLimit | 'other', string> = {
  strokes: `這一筆沒有加入作答：這一題的手寫已達筆數的儲存上限（最多 ${count(DRAWING_LIMITS.maxStrokes)} 筆）。${UNDO_OR_CLEAR}`,
  points: `這一筆沒有加入作答：這一題的手寫已達取樣點的儲存上限（最多 ${count(DRAWING_LIMITS.maxPoints)} 個取樣點）。${UNDO_OR_CLEAR}`,
  geometry: '這一筆沒有加入作答：這一題的筆畫與橡皮擦累計範圍已達儲存上限（較粗的橡皮擦用得多時會先碰到）。請先復原或清除部分筆畫，或改用較細的橡皮擦。',
  draft: '這一筆沒有加入作答：整份作答已達雲端草稿的大小上限。請先復原或清除部分手寫筆畫（任何一題皆可）再繼續。',
  other: `這一筆超過手寫內容的儲存上限，沒有加入作答。${UNDO_OR_CLEAR}`,
}
export const DRAWING_REJECTED_NOTICE = '目前無法變更這題的作答（例如正在提交），這次變更沒有套用。'
export const DRAWING_CAPACITY_TIGHT_STATUS = '手寫容量幾乎用完。'
/** The capacity line under the canvas; it names the limit it is about. */
export function drawingCapacityText(capacity: DrawingCapacity, usage: DrawingUsage): string {
  const about = { strokes: `筆數 ${count(usage.strokes)}／${count(DRAWING_LIMITS.maxStrokes)}`,
    points: `取樣點 ${count(usage.points)}／${count(DRAWING_LIMITS.maxPoints)}`,
    geometry: '筆畫與橡皮擦的累計範圍', draft: '整份作答的大小' }[capacity.limit]
  return capacity.tight ? `手寫容量幾乎用完（${about}），下一筆可能無法加入。`
    : `手寫容量已用 ${Math.min(100, Math.floor(capacity.fraction * 100))}%（${about}）。`
}
export interface DrawingCanvasHandle {
  /** Commit visible pending ink and return the strokes for a combined controlled update. */
  flushPendingStroke: () => DrawingStroke[]
  /** Commit visible pending ink and report whether the owner took it; 'accepted' when nothing was pending. */
  flushPendingInput: () => AnswerOutcome
}
const COLOR_LABELS = ['黑色', '紅色', '藍色']

export function DrawingCanvas({ id, config, strokes, onChange, ref }: DrawingCanvasProps) {
  const showPencilNotice = isIPadOS(navigator)
  const canvas = useRef<HTMLCanvasElement>(null)
  // stroke.points is always what is painted and what a commit would store; run feeds the sampler.
  const pending = useRef<{ pointerId: number; stroke: DrawingStroke; run: DrawingPoint[] } | null>(null)
  // Local commits must accumulate before a controlled parent acknowledges them.
  const committed = useRef(strokes)
  // refusal: the owner did not take the last change, so it is not part of the answer or the canvas.
  const [ink, setInk] = useState<{ controlled: DrawingStroke[]; strokes: DrawingStroke[]
    refusal: CapacityLimit | 'other' | 'rejected' | null }>({ controlled: strokes, strokes, refusal: null })
  if (ink.controlled !== strokes) setInk({ controlled: strokes, strokes, refusal: null })
  const lastOutcome = useRef<AnswerOutcome>('accepted')
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
  const draft = useContext(DraftCapacityContext)
  const usage = useMemo(() => drawingUsage(ink.strokes, config), [ink.strokes, config])
  // The room kept for an ordinary stroke depends on the brush that would draw it.
  const capacity = drawingCapacity(usage, width, draft)

  // At rest the canvas is a full replay of the answer's strokes.
  const paint = (ink: DrawingStroke[]) => {
    const context = canvas.current?.getContext('2d')
    if (context) replayDrawing(context, config, ink)
  }
  // A stroke in progress is painted over that copy, so a pointer move costs the same however many strokes there are.
  const paintPending = (stroke: DrawingStroke) => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (element && context) paintInProgress(context, element, config, committed.current, stroke)
  }
  useLayoutEffect(() => {
    // A new controlled value remains authoritative, including replacement/clear.
    committed.current = strokes
  }, [strokes])
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    const active = pending.current
    if (!element || !context) return
    replayDrawing(context, config, active ? [...committed.current, active.stroke] : committed.current)
    // The replayed canvas is copied so that the next stroke can start from it. Only the canvas being
    // written on refreshes the shared copy; mounting other canvases leaves it alone.
    if (!active && holdsInkOf(element)) rememberInk(element, config, committed.current)
  }, [config, strokes])

  function changeDrawing(action: DrawingAction) {
    const next = drawingReducer({ strokes: committed.current, undone }, action)
    // The owner answers synchronously. Formal submission serializes the owner's answer, so ink it
    // did not accept must not stay on the canvas: visible strokes never run ahead of the answer.
    const outcome = onChange(next.strokes) ?? 'accepted'
    lastOutcome.current = outcome
    setConfirmClear(false)
    if (outcome !== 'accepted') {
      // Name the limit that refused it, the way the stored-answer parser would find it.
      const refusal = outcome === 'rejected' ? 'rejected' : outcome === 'draft-limit' ? 'draft'
        : exceededDrawingLimit(next.strokes, config) ?? 'other'
      setInk({ controlled: strokes, strokes: committed.current, refusal })
      paint(committed.current)
      return committed.current
    }
    committed.current = next.strokes
    setInk({ controlled: strokes, strokes: next.strokes, refusal: null })
    setUndone(next.undone)
    // An accepted stroke is already on the canvas exactly as it was drawn; the owner's acknowledgement
    // replays the answer in full. Every other change (undo, redo, clear) is replayed here as well.
    if (action.type !== 'add') paint(next.strokes)
    if (action.type !== 'add') setStatus(action.type === 'clear' ? '畫布已清除。' : action.type === 'undo' ? '已復原上一筆。' : '已重做一筆。')
    // Said once, when a stroke uses up the room the capacity line keeps for the next one.
    else if (!capacity.tight && drawingCapacity(drawingUsage(next.strokes, config), width, draft).tight) setStatus(DRAWING_CAPACITY_TIGHT_STATUS)
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
    // A canvas is not a form control: honour a disabled form section (e.g. while submitting) ourselves.
    if (event.currentTarget.closest('fieldset[disabled]')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pending.current = { pointerId: event.pointerId, stroke: { tool, color, width, points: [point(event)] }, run: [] }
    paintPending(pending.current.stroke)
    if (tool === 'eraser') updatePreview(event, eraserWidth)
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const active = pending.current
    if (!active) { hover(event); return }
    if (active.pointerId !== event.pointerId) return
    event.preventDefault()
    appendStrokeSample(active.stroke.points, active.run, point(event))
    paintPending(active.stroke)
    if (active.stroke.tool === 'eraser') updatePreview(event, active.stroke.width)
  }
  function finish(event: PointerEvent<HTMLCanvasElement>) {
    const active = pending.current
    if (!active || active.pointerId !== event.pointerId) return
    appendStrokeSample(active.stroke.points, active.run, point(event))
    // The sample taken on release is part of the stroke: it is painted before the stroke is committed.
    paintPending(active.stroke)
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
  function flushPendingInput(): AnswerOutcome {
    if (!pending.current) return 'accepted'
    flushPendingStroke()
    return lastOutcome.current
  }
  useImperativeHandle(ref, () => ({ flushPendingStroke, flushPendingInput }))
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
          min={tool === 'eraser' ? DRAWING_ERASER_WIDTH_MIN : DRAWING_PEN_WIDTH_MIN}
          max={tool === 'eraser' ? DRAWING_ERASER_WIDTH_MAX : DRAWING_PEN_WIDTH_MAX} step="1" value={width}
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
    {(capacity.tight || capacity.fraction >= CAPACITY_HINT_FROM)
      && <p className={`drawing-capacity${capacity.tight ? ' is-tight' : ''}`}>{drawingCapacityText(capacity, usage)}</p>}
    {ink.refusal && <div className="notice warning" role="alert">
      <p>{ink.refusal === 'rejected' ? DRAWING_REJECTED_NOTICE : DRAWING_LIMIT_NOTICES[ink.refusal]}</p></div>}
    {confirmClear && <div className="notice warning" role="alert"><p>清除所有筆畫後無法復原。</p>
      <div className="inline-actions"><button type="button" onClick={() => changeDrawing({ type: 'clear' })}>確認清除</button>
        <button type="button" onClick={() => setConfirmClear(false)}>保留畫布</button></div></div>}
    <p className="drawing-status" role="status">{status}</p>
  </div>
}
