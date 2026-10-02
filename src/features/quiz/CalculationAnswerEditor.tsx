import { useRef } from 'react'
import type { CalculationAnswerMode, CalculationAnswerV4 } from '../../models/attempt'
import type { CalculationQuestion } from '../../models/quiz'
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas'

interface CalculationAnswerEditorProps {
  id: string
  question: CalculationQuestion
  value: CalculationAnswerV4
  onChange: (value: CalculationAnswerV4) => void
}

/** Standalone editor contract; production QuestionInput continues to write legacy answers. */
export function CalculationAnswerEditor({ id, question, value, onChange }: CalculationAnswerEditorProps) {
  const drawing = useRef<DrawingCanvasHandle>(null)
  const drawingMode = question.drawing !== undefined && value.mode === 'drawing'

  function changeMode(mode: CalculationAnswerMode) {
    // Use the returned strokes: a second update based on stale props could otherwise lose the flush.
    const strokes = drawing.current?.flushPendingStroke() ?? value.strokes
    onChange({ ...value, mode, strokes })
  }

  return <div className="calculation-answer-editor">
    {question.drawing !== undefined && <fieldset className="calculation-mode-selector" aria-describedby={`${id}-mode-status`}>
      <legend>本題作答方式</legend>
      <div className="calculation-modes">
        {(['text', 'drawing'] as const).map((mode) => <label key={mode} htmlFor={`${id}-mode-${mode}`}>
          <input id={`${id}-mode-${mode}`} name={`${id}-mode`} type="radio" value={mode}
            checked={value.mode === mode} onChange={() => changeMode(mode)} />
          <span>{mode === 'text' ? '打字' : '手寫'}</span>
        </label>)}
      </div>
      <p className="field-note" id={`${id}-mode-status`} role="status">目前作答方式：{drawingMode ? '手寫' : '打字'}。</p>
    </fieldset>}
    {drawingMode && question.drawing
      ? <DrawingCanvas ref={drawing} id={`${id}-drawing`} config={question.drawing} strokes={value.strokes}
        onChange={(strokes) => onChange({ ...value, strokes })} />
      : <div className="text-answer">
        <label htmlFor={`${id}-text`}>你的推導過程</label>
        <textarea id={`${id}-text`} rows={8} maxLength={100000} value={value.text}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          placeholder={'寫下你的想法與計算步驟…\n也可以使用 $...$ 輸入數學公式。'} />
      </div>}
  </div>
}
