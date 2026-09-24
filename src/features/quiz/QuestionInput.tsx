import { Markdown } from '../../components/Markdown'
import { QUESTION_TYPE, type Question } from '../../models/quiz'
import type { QuestionAnswer } from '../../models/attempt'
import type { DrawingStroke } from '../../models/drawing'
import { DrawingCanvas } from './DrawingCanvas'

export const MANUAL_NOTICE = '此題型將於後續版本提供 AI 參考評分，目前請自行對照參考解答。'
const EMPTY_STROKES: DrawingStroke[] = []

export function QuestionInput({ question, answer, onChange }: {
  question: Question; answer: QuestionAnswer | undefined; onChange: (answer: QuestionAnswer) => void
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
        <input id={id} type="text" autoComplete="off" maxLength={100000}
          value={answer?.type === 'fill' ? answer.text : ''} onChange={(event) => onChange({ type: 'fill', text: event.target.value })}
          aria-describedby={`${id}-match`} placeholder="在這裡輸入答案" />
        <p className="field-note" id={`${id}-match`}>{question.match === 'exact' ? '精確比對，包含大小寫與空格。' : '不區分英文字母大小寫；請勿加上多餘空格。'}</p>
      </div>
    case QUESTION_TYPE.calculation:
      return <div className="text-answer"><p className="manual-notice">{MANUAL_NOTICE}</p>
        <label htmlFor={id}>你的推導過程</label>
        <textarea id={id} rows={8} maxLength={100000} value={answer?.type === 'calculation' ? answer.text : ''}
          onChange={(event) => onChange({ type: 'calculation', text: event.target.value })}
          placeholder={'寫下你的想法與計算步驟…\n也可以使用 $...$ 輸入數學公式。'} />
      </div>
    case QUESTION_TYPE.drawing:
      return <div><p className="manual-notice">{MANUAL_NOTICE}</p>
        <DrawingCanvas id={id} config={question.drawing} strokes={answer?.type === 'drawing' ? answer.strokes : EMPTY_STROKES}
          onChange={(strokes) => onChange({ type: 'drawing', strokes })} />
      </div>
  }
}
