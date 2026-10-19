import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { CalculationAnswerV5 } from '../../models/attempt'
import type { PracticeAnswerV5 } from '../../models/draft-v4'
import type { DrawingStroke } from '../../models/drawing'
import type { CalculationQuestion } from '../../models/quiz'
import type { AnswerOutcome } from './attempt-context'
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas'

export const PAGED_DRAWING_MAX_PAGES = 6

export interface PagedCalculationAnswerEditorHandle {
  flushPendingInput: () => AnswerOutcome
}

interface PagedCalculationAnswerEditorProps {
  id: string
  question: CalculationQuestion
  value: CalculationAnswerV5
  onChange: (answer: PracticeAnswerV5) => AnswerOutcome
  ref?: Ref<PagedCalculationAnswerEditorHandle>
}

/** Schema-3 calculation editor. Page navigation is local; all answer pages remain in the draft. */
export function PagedCalculationAnswerEditor({ id, question, value, onChange, ref }: PagedCalculationAnswerEditorProps) {
  const drawing = useRef<DrawingCanvasHandle>(null)
  const [activePage, setActivePage] = useState(0)
  const [pageIds, setPageIds] = useState(() => value.pages.map((_, index) => `page-${index}`))
  const nextPageId = useRef(value.pages.length)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pageMessage, setPageMessage] = useState('')
  const pages = value.pages
  const drawingMode = question.drawing !== undefined && value.mode === 'drawing'
  const activeStrokes = pages[activePage] ?? []
  const historyKey = pageIds[activePage] ?? `page-${activePage}`
  const capacityStrokes = pages.flatMap((page, index) => index === activePage ? [] : page)

  useEffect(() => {
    setPageIds((current) => {
      if (current.length === pages.length) return current
      return Array.from({ length: pages.length }, (_, index) => current[index] ?? `page-${nextPageId.current++}`)
    })
    setActivePage((current) => Math.min(current, pages.length - 1))
  }, [pages.length])

  useImperativeHandle(ref, () => ({ flushPendingInput: () => drawing.current?.flushPendingInput() ?? 'accepted' }))

  function flushCurrentPage(): DrawingStroke[] | null {
    if (drawing.current?.flushPendingInput() === 'accepted') return drawing.current.flushPendingStroke()
    if (drawing.current) return null
    return pages[activePage] ?? []
  }

  function pageAnswer(strokes: DrawingStroke[], mode = value.mode): CalculationAnswerV5 {
    return { ...value, mode, pages: pages.map((page, index) => index === activePage ? strokes : page) }
  }

  function changeMode(mode: 'text' | 'drawing') {
    if (question.drawing === undefined && mode === 'drawing') return
    const strokes = flushCurrentPage()
    if (strokes === null) return
    const outcome = onChange(pageAnswer(strokes, mode))
    if (outcome !== 'accepted') return
    setConfirmDelete(false)
  }

  function navigate(target: number) {
    if (target < 0 || target >= pages.length || target === activePage) return
    if (flushCurrentPage() === null) return
    setActivePage(target)
    setConfirmDelete(false)
    setPageMessage(`已切換至第 ${target + 1} 頁。`)
  }

  function addPage() {
    if (pages.length >= PAGED_DRAWING_MAX_PAGES) return
    const strokes = flushCurrentPage()
    if (strokes === null) return
    const nextPages = pageAnswer(strokes).pages.concat([[]])
    const outcome = onChange({ ...value, pages: nextPages })
    if (outcome !== 'accepted') return
    setPageIds((current) => [...current, `page-${nextPageId.current++}`])
    setActivePage(nextPages.length - 1)
    setConfirmDelete(false)
    setPageMessage(`已新增第 ${nextPages.length} 頁。`)
  }

  function removePage() {
    if (pages.length <= 1) return
    const strokes = flushCurrentPage()
    if (strokes === null) return
    if (strokes.length > 0 && !confirmDelete) {
      setConfirmDelete(true)
      setPageMessage('本頁有筆畫，請確認是否刪除。')
      return
    }
    const nextPages = pageAnswer(strokes).pages.filter((_, index) => index !== activePage)
    const outcome = onChange({ ...value, pages: nextPages })
    if (outcome !== 'accepted') return
    drawing.current?.forgetHistory(historyKey)
    setPageIds((current) => current.filter((_, index) => index !== activePage))
    const nextActive = Math.min(activePage, nextPages.length - 1)
    setActivePage(nextActive)
    setConfirmDelete(false)
    setPageMessage(`已刪除頁面，目前位於第 ${nextActive + 1} 頁。`)
  }

  return <div className="paged-calculation-editor">
    {question.drawing !== undefined && <fieldset className="calculation-mode-selector" aria-describedby={`${id}-mode-status`}>
      <legend>本題作答方式</legend>
      <div className="calculation-modes">
        {(['text', 'drawing'] as const).map((mode) => <label key={mode} htmlFor={`${id}-mode-${mode}`}>
          <input id={`${id}-mode-${mode}`} name={`${id}-mode`} type="radio" value={mode}
            checked={value.mode === mode} onChange={() => changeMode(mode)} />
          <span><span aria-hidden="true">{mode === 'text' ? '⌨️ ' : '✏️ '}</span>{mode === 'text' ? '打字' : '手寫'}</span>
        </label>)}
      </div>
      <p className="field-note" id={`${id}-mode-status`} role="status">目前作答方式：{drawingMode ? '手寫' : '打字'}。</p>
    </fieldset>}

    {drawingMode && question.drawing
      ? <DrawingCanvas ref={drawing} id={`${id}-page-${activePage + 1}`} config={question.drawing} strokes={activeStrokes}
        historyKey={historyKey} capacityStrokes={capacityStrokes} canvasLabel={`第 ${activePage + 1} 頁手寫作答區`}
        toolbarAddon={<>
          <div className="paged-drawing-controls" role="group" aria-label="手寫頁面控制">
            <button type="button" className="icon-button" aria-label="上一頁" title="上一頁" disabled={activePage === 0}
              onClick={() => navigate(activePage - 1)}>‹</button>
            <span className="paged-drawing-count" role="status" aria-label="手寫頁面狀態">
              第 {activePage + 1} 頁，共 {pages.length} 頁。{pages.length >= PAGED_DRAWING_MAX_PAGES
                ? `已達 ${PAGED_DRAWING_MAX_PAGES} 頁上限。` : ''} {pageMessage}
            </span>
            <button type="button" className="icon-button" aria-label="下一頁" title="下一頁" disabled={activePage >= pages.length - 1}
              onClick={() => navigate(activePage + 1)}>›</button>
            <button type="button" aria-label="新增一頁" title="新增一頁" disabled={pages.length >= PAGED_DRAWING_MAX_PAGES}
              onClick={addPage}>新增頁</button>
            <button type="button" aria-label="刪除本頁" title="刪除本頁" disabled={pages.length <= 1}
              onClick={removePage}>刪除頁</button>
          </div>
          {confirmDelete && <div className="notice warning paged-delete-confirmation" role="alert">
            <p>刪除本頁後，這一頁的手寫筆畫無法復原。</p>
            <div className="inline-actions">
              <button type="button" onClick={removePage}>確認刪除本頁</button>
              <button type="button" className="text-button" onClick={() => { setConfirmDelete(false); setPageMessage('已保留本頁。') }}>保留本頁</button>
            </div>
          </div>}
        </>}
        onChange={(strokes) => onChange(pageAnswer(strokes))} />
      : <div className="text-answer"><label htmlFor={`${id}-text`}>你的推導過程</label>
        <textarea id={`${id}-text`} rows={8} maxLength={100000} value={value.text}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          placeholder={'寫下你的想法與計算步驟…\n也可以使用 $...$ 輸入數學公式。'} />
      </div>}

  </div>
}
