// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { PracticeAnswerMapV5 } from '../../models/draft-v4'
import type { DrawingPoint, DrawingStroke } from '../../models/drawing'
import { AuthorPreview } from '../author/AuthorPreview'
import { DrawingCanvas } from './DrawingCanvas'
import { PracticeContext } from './practice-context'
import { PracticeQuizRoute } from './PracticeQuizRoute'
import { createV4MemoryRepository, v4Catalog, v4Quiz } from './practice-v4.test-helper'

/**
 * An accepted stroke is not repainted when it is committed: it is already on the canvas. What makes
 * the canvas show the answer, and nothing else, is the full replay that follows when the owner hands
 * its strokes back. These tests use the real owners and canvases that each have their own context,
 * as in a browser, and read back exactly which polylines the canvas was asked to draw.
 */
const holder = vi.hoisted(() => ({ catalog: null as null | import('./quiz-loader').QuizCatalog }))
vi.mock('./quiz-loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./quiz-loader')>()
  return { ...actual, quizCatalog: { get current() { return holder.catalog?.current ?? [] }, errors: [],
    getCurrentQuiz: (id: string) => holder.catalog?.getCurrentQuiz(id) ?? null,
    getQuizRevision: (id: string, revision: string) => holder.catalog?.getQuizRevision(id, revision) ?? null } }
})
vi.mock('../auth/auth-context', () => ({ useAuth: () => ({ account: { id: 'student' } }) }))
vi.mock('../ai/use-ai-tutor', () => ({ useAiTutor: () => ({}) }))
vi.mock('../ai/AiTutorControls', () => ({ AiTutorControls: () => null, AiQuotaStatus: () => null }))

type Painted = { images: number; paths: DrawingPoint[][] }
let painted = new WeakMap<HTMLCanvasElement, Painted>()
let contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>()
// How each repaint of a canvas was made, in order: a full replay of strokes, or a copy of the finished strokes
// with the stroke in progress drawn over it.
let repaints = new WeakMap<HTMLCanvasElement, ('replay' | 'copy')[]>()
// Every canvas that was asked for a context in this test; the one outside the document is the offscreen copy.
let used = new Set<HTMLCanvasElement>()
beforeEach(() => {
  holder.catalog = v4Catalog
  localStorage.clear()
  painted = new WeakMap(); contexts = new WeakMap(); repaints = new WeakMap(); used = new Set()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    used.add(this)
    let context = contexts.get(this)
    if (!context) {
      // What this canvas holds since it was last cleared: copied images and the polylines drawn on it.
      const state = (): Painted => painted.get(this) ?? painted.set(this, { images: 0, paths: [] }).get(this)!
      const made = () => repaints.get(this) ?? repaints.set(this, []).get(this)!
      const noop = () => undefined
      context = { save: noop, restore: noop, arc: noop, fill: noop, stroke: noop,
        clearRect: () => { painted.set(this, { images: 0, paths: [] }); made().push('replay') },
        drawImage: () => { state().images++; made().splice(-1, 1, 'copy') },
        beginPath: () => { state().paths.push([]) },
        moveTo: (x: number, y: number) => { state().paths.at(-1)!.push({ x, y }) },
        lineTo: (x: number, y: number) => { state().paths.at(-1)!.push({ x, y }) } } as unknown as CanvasRenderingContext2D
      contexts.set(this, context)
    }
    return context
  } as unknown as HTMLCanvasElement['getContext'])
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture: () => undefined, hasPointerCapture: () => false,
    releasePointerCapture: () => undefined })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function pointer(target: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: 8 }, isPrimary: { value: true }, pointerType: { value: 'pen' } })
  fireEvent(target, event)
}
/** A zigzag whose samples are all stored (far apart), released at a position of its own. */
const zigzag = (y: number): DrawingPoint[] => Array.from({ length: 6 }, (_, step) => ({ x: 40 + step * 70, y: y + (step % 2) * 50 }))
const shown = (canvas: Element) => painted.get(canvas as HTMLCanvasElement) ?? { images: 0, paths: [] }
/** Releases the pointer and returns how the canvas was repainted because of it. */
function release(target: Element, at: DrawingPoint) {
  const before = (repaints.get(target as HTMLCanvasElement) ?? []).length
  pointer(target, 'pointerup', at.x, at.y)
  return (repaints.get(target as HTMLCanvasElement) ?? []).slice(before)
}
const handCanvas = () => screen.getByRole('img', { name: '第 1 頁手寫作答區' }) as HTMLCanvasElement

describe('after every accepted stroke the canvas is replayed in full from the owner\'s answer', () => {
  it('on the practice page: the replay is exactly the strokes the practice store holds', async () => {
    const user = userEvent.setup()
    const server = createV4MemoryRepository('student')
    render(<PracticeContext.Provider value={server.repo}>
      <MemoryRouter initialEntries={[`/quiz/${v4Quiz.id}`]}><Routes>
        <Route path="/quiz/:quizId" element={<PracticeQuizRoute />} />
      </Routes></MemoryRouter></PracticeContext.Provider>)
    await user.click(await screen.findByRole('radio', { name: '手寫' }))
    /** The strokes of q_hand as the practice store holds them: its local cache is written on every accepted change. */
    const held = (): DrawingStroke[] => {
      for (const key of Object.keys(localStorage)) {
        if (key.includes(':recovery:')) continue
        const value = JSON.parse(localStorage.getItem(key)!) as { attempt?: { answers?: Record<string, { strokes?: DrawingStroke[]; pages?: DrawingStroke[][] }> } }
        const answer = value.attempt?.answers?.q_hand
        if (answer?.pages) return answer.pages.flat()
        if (answer?.strokes) return answer.strokes
      }
      return []
    }
    for (let stroke = 1; stroke <= 4; stroke++) {
      const samples = zigzag(40 + stroke * 90)
      pointer(handCanvas(), 'pointerdown', samples[0].x, samples[0].y)
      for (const sample of samples.slice(1, -1)) pointer(handCanvas(), 'pointermove', sample.x, sample.y)
      // In progress: a copy of the finished strokes and the one being drawn.
      expect(shown(handCanvas())).toMatchObject({ images: 1 })
      expect(shown(handCanvas()).paths).toHaveLength(1)
      // The release sample is painted over the copy, then the acknowledgement replays the answer: once.
      expect(release(handCanvas(), samples.at(-1)!)).toEqual(['copy', 'replay'])
      // Accepted and acknowledged: no copy is left, every stroke of the answer was drawn, point for point.
      expect(held()).toHaveLength(stroke)
      expect(held().at(-1)!.points).toEqual(samples)
      expect(shown(handCanvas()).images).toBe(0)
      expect(shown(handCanvas()).paths).toEqual(held().map((item) => item.points))
    }
  })

  it('in Author Preview: the replay is exactly the strokes of the preview answer', () => {
    let answers: PracticeAnswerMapV5 = {}
    function Preview() {
      const [state, setState] = useState<PracticeAnswerMapV5>({})
      return <AuthorPreview quiz={v4Quiz} mode="student" answers={state} onAnswer={(id, answer) => {
        answers = { ...answers, [id]: answer }
        setState((current) => ({ ...current, [id]: answer }))
      }} />
    }
    render(<Preview />)
    fireEvent.click(screen.getByRole('radio', { name: '手寫' }))
    for (let stroke = 1; stroke <= 3; stroke++) {
      const samples = zigzag(60 + stroke * 100)
      pointer(handCanvas(), 'pointerdown', samples[0].x, samples[0].y)
      for (const sample of samples.slice(1, -1)) pointer(handCanvas(), 'pointermove', sample.x, sample.y)
      expect(release(handCanvas(), samples.at(-1)!)).toEqual(['copy', 'replay'])
      const answer = answers.q_hand
      const strokes = answer?.type === 'calculation' && answer.mode === 'drawing' && 'pages' in answer ? answer.pages[0] : []
      expect(strokes).toHaveLength(stroke)
      expect(strokes.at(-1)!.points).toEqual(samples)
      expect(shown(handCanvas()).images).toBe(0)
      expect(shown(handCanvas()).paths).toEqual(strokes.map((item) => item.points))
    }
  })
})

describe('strokes that are not acknowledged with new strokes', () => {
  const config = { width: 800, height: 600 }
  const canvas = () => screen.getByRole('img', { name: '繪圖作答區' })

  it('a refused stroke, including the sample taken on release, does not stay on the canvas', () => {
    const accepted: DrawingStroke[] = [{ tool: 'pen', color: '#202b38', width: 4, points: [{ x: 10, y: 10 }, { x: 700, y: 10 }] }]
    render(<DrawingCanvas id="refused" config={config} strokes={accepted} onChange={() => 'limit'} />)
    const samples = zigzag(200)
    pointer(canvas(), 'pointerdown', samples[0].x, samples[0].y)
    for (const sample of samples.slice(1, -1)) pointer(canvas(), 'pointermove', sample.x, sample.y)
    expect(shown(canvas()).paths.at(-1)).toEqual(samples.slice(0, -1))
    expect(release(canvas(), samples.at(-1)!)).toEqual(['copy', 'replay'])
    // Replayed in full from the accepted strokes only: no copy, and none of the refused stroke's points.
    expect(shown(canvas()).images).toBe(0)
    expect(shown(canvas()).paths).toEqual(accepted.map((item) => item.points))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('an owner that accepts without handing new strokes back still sees the complete stroke, and the next stroke builds on it', () => {
    const initial: DrawingStroke[] = []
    const seen: DrawingStroke[][] = []
    render(<DrawingCanvas id="silent" config={config} strokes={initial} onChange={(next) => { seen.push(next); return 'accepted' }} />)
    const first = zigzag(100)
    pointer(canvas(), 'pointerdown', first[0].x, first[0].y)
    for (const sample of first.slice(1, -1)) pointer(canvas(), 'pointermove', sample.x, sample.y)
    expect(release(canvas(), first.at(-1)!)).toEqual(['copy'])
    expect(seen.at(-1)![0].points).toEqual(first)
    // No acknowledgement, so no replay: the canvas keeps the picture it drew, which includes the release sample.
    expect(shown(canvas()).images).toBe(1)
    expect(shown(canvas()).paths).toEqual([first])
    // The next stroke starts from a copy that holds the first one (rebuilt, because the owner's array never changed).
    const second = zigzag(300)
    pointer(canvas(), 'pointerdown', second[0].x, second[0].y)
    pointer(canvas(), 'pointermove', second[1].x, second[1].y)
    const copies = [...used].filter((element) => !element.isConnected)
    expect(shown(canvas())).toEqual({ images: 1, paths: [second.slice(0, 2)] })
    expect(copies).toHaveLength(1)
    expect(shown(copies[0])).toEqual({ images: 0, paths: [first] })
    for (const sample of second.slice(2, -1)) pointer(canvas(), 'pointermove', sample.x, sample.y)
    pointer(canvas(), 'pointerup', second.at(-1)!.x, second.at(-1)!.y)
    expect(seen.at(-1)!.map((item) => item.points)).toEqual([first, second])
    expect(shown(canvas())).toEqual({ images: 1, paths: [second] })
  })
})
