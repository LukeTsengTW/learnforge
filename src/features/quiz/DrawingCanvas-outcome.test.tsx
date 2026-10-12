// @vitest-environment jsdom
import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DrawingStroke } from '../../models/drawing'
import type { PracticeAnswerMap } from '../../models/draft-v4'
import { AuthorPreview } from '../author/AuthorPreview'
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas'
import { v4Quiz } from './practice-v4.test-helper'

/**
 * The canvas keeps only ink its owner accepted. The owner answers every change synchronously with
 * 'accepted', 'limit' or 'rejected'; anything else than 'accepted' must leave the canvas, its undo
 * history and the answer untouched and must tell the user why.
 */
const config = { width: 800, height: 600 }
type Outcome = 'accepted' | 'limit' | 'rejected'
let painted = 0
beforeEach(() => {
  localStorage.clear()
  painted = 0
  const noop = () => undefined
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ save: noop, restore: noop,
    clearRect: () => { painted = 0 }, beginPath: () => { painted++ }, arc: noop, fill: noop, moveTo: noop,
    lineTo: noop, stroke: noop } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture: () => undefined, hasPointerCapture: () => false,
    releasePointerCapture: () => undefined })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const canvas = () => screen.getByRole('img', { name: '繪圖作答區' })
function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: 4 }, isPrimary: { value: true }, pointerType: { value: 'pen' } })
  fireEvent(canvas(), event)
}
function draw(y: number) { pointer('pointerdown', 10, y); pointer('pointermove', 200, y); pointer('pointerup', 400, y) }

/** A controlled owner that accepts at most `capacity` strokes and can be locked. */
function Owner({ capacity = 2, locked = false, handle, disabled = false, seen }: {
  capacity?: number; locked?: boolean; handle?: React.Ref<DrawingCanvasHandle>; disabled?: boolean; seen?: DrawingStroke[][]
}) {
  const [ink, setInk] = useState<DrawingStroke[]>([])
  const decide = (next: DrawingStroke[]): Outcome => locked ? 'rejected' : next.length > capacity ? 'limit' : 'accepted'
  return <fieldset disabled={disabled}><DrawingCanvas ref={handle} id="outcome" config={config} strokes={ink}
    onChange={(next) => { const outcome = decide(next); if (outcome === 'accepted') { seen?.push(next); setInk(next) }; return outcome }} /></fieldset>
}

describe('DrawingCanvas keeps only accepted ink', () => {
  it('drops a stroke the owner refuses for the limit, keeps the accepted ones and explains', () => {
    const seen: DrawingStroke[][] = []
    render(<Owner capacity={2} seen={seen} />)
    draw(100); draw(200)
    expect(painted).toBe(2)
    draw(300)
    expect(painted).toBe(2)
    expect(seen.at(-1)).toHaveLength(2)
    expect(screen.getByRole('alert')).toHaveTextContent('儲存上限（最多 256 筆、6000 個取樣點）')
    expect(screen.getByRole('alert')).toHaveTextContent('沒有加入作答')
    // The refused stroke is not in the undo history either: one undo removes the second accepted stroke.
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(painted).toBe(1)
    expect(seen.at(-1)).toHaveLength(1)
    expect(screen.queryByRole('alert')).toBeNull()
    // The next stroke builds on the accepted strokes only.
    draw(400)
    expect(painted).toBe(2)
    expect(seen.at(-1)!.map((item) => item.points[0].y)).toEqual([100, 400])
  })

  it('does not apply any change while the owner is locked, and says the change was not applied', () => {
    const view = render(<Owner capacity={5} />)
    draw(100)
    view.rerender(<Owner capacity={5} locked />)
    draw(200)
    expect(painted).toBe(1)
    expect(screen.getByRole('alert')).toHaveTextContent('這次變更沒有套用')
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(painted).toBe(1)
    view.rerender(<Owner capacity={5} />)
    draw(300)
    expect(painted).toBe(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports the outcome of completing a pending stroke, and returns only accepted strokes', () => {
    const handle = createRef<DrawingCanvasHandle>()
    render(<Owner capacity={1} handle={handle} />)
    // Nothing pending.
    expect(handle.current!.flushPendingInput()).toBe('accepted')
    pointer('pointerdown', 10, 100); pointer('pointermove', 200, 100)
    let outcome: Outcome | undefined
    act(() => { outcome = handle.current!.flushPendingInput() })
    expect(outcome).toBe('accepted')
    expect(painted).toBe(1)
    pointer('pointerdown', 10, 200); pointer('pointermove', 200, 200)
    expect(painted).toBe(2) // the gesture in progress is visible until it is completed
    act(() => { outcome = handle.current!.flushPendingInput() })
    expect(outcome).toBe('limit')
    expect(painted).toBe(1)
    let strokes: DrawingStroke[] = []
    act(() => { strokes = handle.current!.flushPendingStroke() })
    expect(strokes).toHaveLength(1)
    // The gesture is over: later events of the same pointer add nothing.
    pointer('pointermove', 300, 300); pointer('pointerup', 400, 400)
    expect(painted).toBe(1)
  })

  it('takes no new contact inside a disabled form section', () => {
    const view = render(<Owner capacity={5} disabled />)
    draw(100)
    expect(painted).toBe(0)
    expect(screen.queryByRole('alert')).toBeNull()
    view.rerender(<Owner capacity={5} />)
    draw(100)
    expect(painted).toBe(1)
  })

  it('treats an owner without a result as accepting (plain controlled use)', () => {
    function Plain() {
      const [ink, setInk] = useState<DrawingStroke[]>([])
      return <DrawingCanvas id="plain" config={config} strokes={ink} onChange={(next) => { setInk(next) }} />
    }
    render(<Plain />)
    draw(100); draw(200)
    expect(painted).toBe(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Author Preview owner', () => {
  it('reports accepted for every answer, so preview ink accumulates and is never refused', () => {
    const answers: PracticeAnswerMap[] = []
    function Preview() {
      const [state, setState] = useState<PracticeAnswerMap>({})
      return <AuthorPreview quiz={v4Quiz} mode="student" answers={state}
        onAnswer={(id, answer) => { const next = { ...state, [id]: answer }; answers.push(next); setState(next) }} />
    }
    render(<Preview />)
    fireEvent.click(screen.getByRole('radio', { name: '手寫' }))
    const hand = document.querySelector('canvas[aria-describedby="answer-q_hand-drawing-instructions"]')!
    const fire = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
      Object.defineProperties(event, { pointerId: { value: 4 }, isPrimary: { value: true } })
      fireEvent(hand, event)
    }
    for (const y of [100, 200, 300]) { fire('pointerdown', 10, y); fire('pointerup', 400, y) }
    const answer = answers.at(-1)!.q_hand
    expect(answer.type === 'calculation' && answer.mode === 'drawing' ? answer.strokes : []).toHaveLength(3)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
