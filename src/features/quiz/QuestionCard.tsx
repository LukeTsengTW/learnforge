import { useState } from 'react'
import { Markdown } from '../../components/Markdown'
import { hasAnswer } from '../../lib/grading'
import { isObjectiveQuestion, QUESTION_LABEL, type Question } from '../../models/quiz'
import type { QuestionAnswer } from '../../models/attempt'
import { QuestionInput } from './QuestionInput'

export function QuestionCard({ question, index, answer, onChange }: {
  question: Question; index: number; answer: QuestionAnswer | undefined; onChange: (answer: QuestionAnswer) => void
}) {
  const [hintOpen, setHintOpen] = useState(false)
  return <section className="question-card" aria-labelledby={`heading-${question.id}`}>
    <div className="question-meta"><h2 id={`heading-${question.id}`} tabIndex={-1}><span className="question-number">{String(index + 1).padStart(2, '0')}</span>{QUESTION_LABEL[question.type]}</h2>
      <div className="question-meta-right"><span>{question.points} 分{!isObjectiveQuestion(question) && '・自行對照'}</span>
        {hasAnswer(answer) && <span className="answered-mark">✓ 已作答</span>}</div>
    </div>
    <div id={`prompt-${question.id}`} className="question-prompt"><Markdown>{question.prompt}</Markdown></div>
    <QuestionInput question={question} answer={answer} onChange={onChange} />
    {question.hint && <div className="hint-area"><button type="button" className="hint-button" aria-expanded={hintOpen}
      aria-controls={`hint-${question.id}`} onClick={() => setHintOpen(!hintOpen)}><span aria-hidden="true">{hintOpen ? '−' : '+'}</span> {hintOpen ? '收起提示' : '需要一點提示？'}</button>
      {hintOpen && <div id={`hint-${question.id}`} className="hint-content"><Markdown>{question.hint}</Markdown></div>}
    </div>}
  </section>
}
