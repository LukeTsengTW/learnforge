import { useEffect, useRef } from 'react'
import { Markdown } from '../../components/Markdown'
import { QUESTION_TYPE, type CalculationQuestion, type Question } from '../../models/quiz'
import type { CalculationAnswerV4 } from '../../models/attempt'
import type { DraftSchemaVersion, PracticeAnswer } from '../../models/draft-v4'
import type { DrawingStroke } from '../../models/drawing'
import { emptyCalculationAnswerV4 } from '../../lib/draft-v4'
import { isV4BlankText } from '../../lib/v4-blank'
import { GRADING_ANSWER_MAX_BYTES } from '../../../supabase/functions/_shared/calculation-grading.ts'
import { CalculationAnswerEditor, type CalculationAnswerEditorHandle } from './CalculationAnswerEditor'
import { DrawingCanvas } from './DrawingCanvas'
import type { PendingInputFlush } from './attempt-context'

export const MANUAL_NOTICE = '畫圖題不納入自動分數；提交後可自行對照評分規準，符合條件時可使用 AI 圖像參考分析。'
const V3_RUBRIC_NOTICE = '提交後會依評分規準由 AI 自動評分並納入本次練習得分。AI 自動評分僅供學習參考，可能存在誤判。'
export const FORMAL_TEXT_LIMIT_NOTICE = '目前打字作答超過正式評分的長度上限；草稿仍會保存，但提交前請精簡內容。'
const EMPTY_STROKES: DrawingStroke[] = []

/** Full v4 value for the editor; a legacy-shaped value is shown as text without changing storage. */
function calculationValueV4(answer: PracticeAnswer | undefined): CalculationAnswerV4 {
  if (answer?.type !== 'calculation') return emptyCalculationAnswerV4()
  if (answer.mode === 'text' || answer.mode === 'drawing') return answer
  return { ...emptyCalculationAnswerV4(), text: answer.text }
}

function CalculationV4Input({ id, question, answer, onChange, registerPendingFlush }: {
  id: string; question: CalculationQuestion; answer: PracticeAnswer | undefined
  onChange: (answer: PracticeAnswer) => void; registerPendingFlush?: (flush: PendingInputFlush) => () => void
}) {
  const editor = useRef<CalculationAnswerEditorHandle>(null)
  useEffect(() => registerPendingFlush?.(() => { editor.current?.flushPendingInput() }), [registerPendingFlush])
  const value = calculationValueV4(answer)
  // Non-authoritative hint only: the server enforces the formal limit (HTTP 422) and the text is never truncated.
  const overLimit = value.mode === 'text' && !isV4BlankText(value.text)
    && new TextEncoder().encode(value.text).length > GRADING_ANSWER_MAX_BYTES
  return <div><p className="field-note">{V3_RUBRIC_NOTICE}</p>
    <CalculationAnswerEditor ref={editor} id={id} question={question} value={value} onChange={onChange} />
    {overLimit && <p className="field-note notice warning" role="status">{FORMAL_TEXT_LIMIT_NOTICE}</p>}
  </div>
}

export function QuestionInput({ question, answer, onChange, draftSchema = 1, registerPendingFlush }: {
  question: Question; answer: PracticeAnswer | undefined; onChange: (answer: PracticeAnswer) => void
  draftSchema?: DraftSchemaVersion; registerPendingFlush?: (flush: PendingInputFlush) => () => void
}) {
  const id = `answer-${question.id}`
  switch (question.type) {
    case QUESTION_TYPE.single:
    case QUESTION_TYPE.multiple:
      return <fieldset className="choice-list"><legend className="sr-only">{question.type === 'single' ? '選擇一個答案' : '選擇所有正確答案'}</legend>
        {question.options.map((option, index) => {
          const checked = answer?.type === 'single' ? answer.optionId === option.id
            : answer?.type === 'multiple' ? answer.optionIds.includes(option.id) : false
          return <label className={`choice-row${checked ? ' is-selected' : ''}`} key={option.id} htmlFor={`${id}-${option.id}`}>
            <input id={`${id}-${option.id}`} name={id} type={question.type === 'single' ? 'radio' : 'checkbox'} checked={checked}
              onChange={() => {
                if (question.type === 'single') onChange({ type: 'single', optionId: option.id })
                else {
                  const selected = answer?.type === 'multiple' ? answer.optionIds : []
                  onChange({ type: 'multiple', optionIds: checked ? selected.filter((item) => item !== option.id) : [...selected, option.id] })
                }
              }} />
            <span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
            <Markdown inline>{option.content}</Markdown>
          </label>
        })}
      </fieldset>
    case QUESTION_TYPE.trueFalse:
      return <fieldset className="choice-list binary-choice"><legend className="sr-only">判斷敘述是否正確</legend>
        {[true, false].map((value) => {
          const checked = answer?.type === 'true-false' && answer.value === value
          return <label key={String(value)} className={`choice-row${checked ? ' is-selected' : ''}`} htmlFor={`${id}-${value}`}>
            <input id={`${id}-${value}`} type="radio" name={id} checked={checked} onChange={() => onChange({ type: 'true-false', value })} />
            {value ? '正確（True）' : '錯誤（False）'}
          </label>
        })}
      </fieldset>
    case QUESTION_TYPE.fill:
      return <div className="text-answer"><label htmlFor={id}>你的答案</label>
        <input id={id} type="text" autoComplete="off" maxLength={1365}
          value={answer?.type === 'fill' ? answer.text : ''} onChange={(event) => onChange({ type: 'fill', text: event.target.value })}
          aria-describedby={`${id}-match`} placeholder="在這裡輸入答案" />
        <p className="field-note" id={`${id}-match`}>先依{question.match === 'exact' ? '精確' : '不區分大小寫'}規則比對；未符合時會由 AI 判斷語意，影響正式分數。</p>
      </div>
    case QUESTION_TYPE.calculation:
      if (draftSchema === 2) return <CalculationV4Input id={id} question={question} answer={answer} onChange={onChange}
        registerPendingFlush={registerPendingFlush} />
      return <div className="text-answer"><p className="field-note">{V3_RUBRIC_NOTICE}</p>
        <label htmlFor={id}>你的推導過程</label>
        <textarea id={id} rows={8} maxLength={100000} value={answer?.type === 'calculation' ? answer.text : ''}
          onChange={(event) => onChange({ type: 'calculation', text: event.target.value })}
          placeholder={'寫下你的想法與計算步驟…\n也可以使用 $...$ 輸入數學公式。'} />
      </div>
    case QUESTION_TYPE.drawing:
      return <div><p className="field-note">{V3_RUBRIC_NOTICE}</p>
        <DrawingCanvas id={id} config={question.drawing} strokes={answer?.type === 'drawing' ? answer.strokes : EMPTY_STROKES}
          onChange={(strokes) => onChange({ type: 'drawing', strokes })} />
      </div>
  }
}
