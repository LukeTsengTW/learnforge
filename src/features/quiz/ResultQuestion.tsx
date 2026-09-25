import { Markdown } from '../../components/Markdown'
import { GRADE_STATUS, type QuestionAnswer, type QuestionGrade } from '../../models/attempt'
import { QUESTION_LABEL, QUESTION_TYPE, type Question } from '../../models/quiz'
import { hasAnswer } from '../../lib/grading'
import { DrawingPreview } from './DrawingPreview'
import { MANUAL_NOTICE } from './QuestionInput'

const STATUS_LABEL = {
  [GRADE_STATUS.correct]: '✓ 正確', [GRADE_STATUS.incorrect]: '✕ 錯誤',
  [GRADE_STATUS.unanswered]: '− 未作答', [GRADE_STATUS.manual]: '自行對照',
}

function StudentAnswer({ question, answer }: { question: Question; answer: QuestionAnswer | undefined }) {
  if (!answer || !hasAnswer(answer)) return <p className="muted">未作答</p>
  if (answer.type === 'drawing' && question.type === 'drawing') return <DrawingPreview config={question.drawing} strokes={answer.strokes} id={question.id} />
  if (answer.type === 'calculation') return <div className="student-calculation"><Markdown>{answer.text}</Markdown></div>
  // Fill strings are literal answers; Markdown syntax must not disguise mismatches.
  if (answer.type === 'fill') return <p className="literal-answer">{answer.text}</p>
  if (answer.type === 'true-false') return <p>{answer.value ? '正確（True）' : '錯誤（False）'}</p>
  if ((question.type === 'single' || question.type === 'multiple') && (answer.type === 'single' || answer.type === 'multiple')) {
    const selected = answer.type === 'single' ? [answer.optionId] : answer.optionIds
    return <ul className="answer-options">{question.options.filter((option) => selected.includes(option.id)).map((option) =>
      <li key={option.id}><span className="option-letter">{option.id.toUpperCase()}</span><Markdown>{option.content}</Markdown></li>)}</ul>
  }
  return <p className="muted">未作答</p>
}

function CorrectAnswer({ question }: { question: Question }) {
  switch (question.type) {
    case QUESTION_TYPE.single:
    case QUESTION_TYPE.multiple: {
      const correct = question.type === 'single' ? [question.correctOptionId] : question.correctOptionIds
      return <ul className="answer-options">{question.options.filter((option) => correct.includes(option.id)).map((option) =>
        <li key={option.id}><span className="option-letter">{option.id.toUpperCase()}</span><Markdown>{option.content}</Markdown></li>)}</ul>
    }
    case QUESTION_TYPE.trueFalse: return <p>{question.correctAnswer ? '正確（True）' : '錯誤（False）'}</p>
    case QUESTION_TYPE.fill: return <Markdown>{question.correctAnswer}</Markdown>
    case QUESTION_TYPE.calculation:
    case QUESTION_TYPE.drawing: return <Markdown>{question.referenceAnswer}</Markdown>
  }
}

export function ResultQuestion({ question, answer, grade, index, idPrefix = '' }: {
  question: Question; answer: QuestionAnswer | undefined; grade: QuestionGrade; index: number; idPrefix?: string
}) {
  const manual = grade.status === GRADE_STATUS.manual
  return <section className="question-card result-question" aria-labelledby={`result-heading-${idPrefix}${question.id}`}>
    <div className="question-meta"><h2 id={`result-heading-${idPrefix}${question.id}`}><span className="question-number">{String(index + 1).padStart(2, '0')}</span>{QUESTION_LABEL[question.type]}</h2>
      <div className="question-meta-right"><span className={`status-badge status-${grade.status}`}>{STATUS_LABEL[grade.status]}</span>
        {!manual && <span>{grade.score} / {grade.maxScore} 分</span>}</div>
    </div>
    <div className="question-prompt"><Markdown>{question.prompt}</Markdown></div>
    {manual && <p className="manual-notice">{MANUAL_NOTICE}</p>}
    <div className={`answer-comparison${question.type === 'drawing' ? ' drawing-comparison' : ''}`}>
      <div className="student-answer"><h3>你的答案</h3><StudentAnswer question={question} answer={answer} /></div>
      <div className="reference-answer"><h3>{manual ? '參考答案' : '正確答案'}</h3><CorrectAnswer question={question} /></div>
    </div>
    <div className="solution-block"><h3>解題說明</h3><Markdown>{question.solution}</Markdown></div>
    {question.rubric.length > 0 && <div className="rubric-block"><h3>評分規準{manual && '（供自行對照）'}</h3><ul>
      {question.rubric.map((criterion, index) => <li key={index}><Markdown>{criterion.description}</Markdown>
        {criterion.score !== null && <span>{criterion.score} 分</span>}</li>)}
    </ul></div>}
  </section>
}
