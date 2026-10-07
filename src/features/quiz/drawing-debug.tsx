import { useEffect, useState, type RefObject } from 'react'
import type { DrawingInputMode } from '../../lib/drawing-input-mode'

const EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture',
  'pointerover', 'pointerenter', 'pointerout', 'pointerleave', 'touchstart', 'touchmove', 'touchend', 'touchcancel']
const CAPACITY = 500
interface Snapshot {
  canvas: HTMLCanvasElement | null
  pendingPointerId: number | null
  inputMode: DrawingInputMode
}
export type DebugDecision = 'observed' | 'accepted' | 'rejected'
interface Entry {
  time: number
  type: string
  source: 'document-capture' | 'canvas'
  phase: 'dom' | 'react-handler' | 'imperative'
  target: { tag: string; classes: string[] } | null
  pointerId: number | null
  pointerType: string | null
  isPrimary: boolean | null
  button: number | null
  buttons: number | null
  pressure: number | null
  clientX: number | null
  clientY: number | null
  hasPointerCapture: boolean | null
  pendingPointerId: number | null
  inputMode: DrawingInputMode
  decision: DebugDecision
  label: string
  reason: string | null
  changedTouches?: { identifier: number; touchType: string | null; clientX: number; clientY: number }[]
}

// No event objects, DOM text/values, stroke data, account state, storage or network.
// The ring and panel never schedule updates from input events.
class DrawingDebug {
  private entries: Entry[] = []
  private next = 0
  private dropped = 0

  record(event: Event | null, source: Entry['source'], phase: Entry['phase'], state: Snapshot,
    decision: DebugDecision = 'observed', label = 'DOM_EVENT', reason: string | null = null) {
    // Diagnostics must never interrupt production handlers on an older browser.
    try {
      const pointer = event && 'pointerId' in event ? event as PointerEvent : null
      const target = event?.target instanceof Element ? event.target : null
      let captured: boolean | null = null
      try { if (pointer && state.canvas) captured = state.canvas.hasPointerCapture(pointer.pointerId) } catch { /* unavailable */ }
      const entry: Entry = {
        time: performance.now(), type: event?.type ?? 'imperative-flush', source, phase,
        target: target ? { tag: target.tagName.toLowerCase(), classes: ['drawing-canvas', 'canvas-frame', 'drawing-editor'].filter(name => target.classList.contains(name)) } : null,
        pointerId: pointer?.pointerId ?? null, pointerType: pointer?.pointerType ?? null, isPrimary: pointer?.isPrimary ?? null,
        button: pointer?.button ?? null, buttons: pointer?.buttons ?? null, pressure: pointer?.pressure ?? null,
        clientX: pointer?.clientX ?? null, clientY: pointer?.clientY ?? null,
        hasPointerCapture: captured, pendingPointerId: state.pendingPointerId, inputMode: state.inputMode, decision, label, reason,
      }
      if (event && 'changedTouches' in event) {
        entry.changedTouches = Array.from((event as TouchEvent).changedTouches, touch => ({
          identifier: touch.identifier, touchType: (touch as Touch & { touchType?: string }).touchType ?? null,
          clientX: touch.clientX, clientY: touch.clientY,
        }))
      }
      if (this.entries.length < CAPACITY) this.entries.push(entry)
      else { this.entries[this.next] = entry; this.next = (this.next + 1) % CAPACITY; this.dropped++ }
    } catch { /* observation only */ }
  }
  clear() { this.entries = []; this.next = 0; this.dropped = 0 }
  serialize() {
    const entries = [...this.entries.slice(this.next), ...this.entries.slice(0, this.next)]
    return JSON.stringify({ format: 'learnforge-drawing-debug-1', capacity: CAPACITY, dropped: this.dropped, entries }, null, 2)
  }
}

export function useDrawingDebug(canvas: RefObject<HTMLCanvasElement | null>, pending: RefObject<{ pointerId: number } | null>, inputMode: DrawingInputMode) {
  const [debug] = useState(() => new URLSearchParams(window.location.search).get('drawingDebug') === '1' ? new DrawingDebug() : null)
  useEffect(() => {
    if (!debug || !canvas.current) return
    const element = canvas.current
    const observe = (source: Entry['source']) => (event: Event) => debug.record(event, source, 'dom', {
      canvas: element, pendingPointerId: pending.current?.pointerId ?? null, inputMode,
    })
    const documentListener = observe('document-capture'), canvasListener = observe('canvas')
    const options = { capture: true, passive: true }
    for (const type of EVENTS) {
      document.addEventListener(type, documentListener, options)
      element.addEventListener(type, canvasListener, options)
    }
    return () => {
      for (const type of EVENTS) {
        document.removeEventListener(type, documentListener, options)
        element.removeEventListener(type, canvasListener, options)
      }
    }
  }, [debug, canvas, pending, inputMode])
  return debug
}

export function DrawingDebugPanel({ debug }: { debug: DrawingDebug }) {
  const [status, setStatus] = useState('僅在此頁記憶體保留最後 500 筆事件；沒有網路傳送。')
  const [fallback, setFallback] = useState('')
  async function copy() {
    const text = debug.serialize()
    try {
      await navigator.clipboard.writeText(text)
      setFallback('')
      setStatus('已複製診斷紀錄。')
    } catch {
      setFallback(text)
      setStatus('無法自動複製；請選取下方紀錄並手動複製。')
    }
  }
  return <section className="notice" role="region" aria-label="繪圖事件診斷">
    <strong>繪圖事件診斷（已啟用）</strong>
    <p>{status}</p>
    <div className="inline-actions">
      <button type="button" onClick={() => { debug.clear(); setFallback(''); setStatus('紀錄已清除。') }}>清除紀錄</button>
      <button type="button" onClick={copy}>複製診斷紀錄</button>
    </div>
    {fallback && <label>診斷紀錄<textarea readOnly value={fallback} rows={6} /></label>}
  </section>
}
