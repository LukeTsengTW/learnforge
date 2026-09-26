import { Markdown } from '../../components/Markdown'
import { QuestionCard } from '../quiz/QuestionCard'
import { ResultQuestion } from '../quiz/ResultQuestion'
import { gradeQuiz } from '../../lib/grading'
import type { AnswerMap, QuestionAnswer } from '../../models/attempt'
import type { Quiz } from '../../models/quiz'

export function AuthorPreview({ quiz, mode, answers, onAnswer }: {
  quiz: Quiz
  mode: 'student' | 'answer'
  answers: AnswerMap
  onAnswer: (questionId: string, answer: QuestionAnswer) => void
}) {
  const grades = mode === 'answer' ? gradeQuiz(quiz, answers).questions : []
  return <div className="author-preview-content">
    <header className="page-heading"><span className="subject-label">{quiz.subject}</span>
      <h2>{quiz.title}</h2><Markdown>{quiz.description}</Markdown></header>
    <div className="question-stack">
      {quiz.questions.map((question, index) => <div id={`author-question-${question.id}`} key={question.id}>
        {mode === 'student'
          ? <QuestionCard question={question} index={index} answer={answers[question.id]}
            onChange={(answer) => onAnswer(question.id, answer)} />
          : <ResultQuestion question={question} index={index} answer={answers[question.id]}
            grade={grades[index]} idPrefix="author-" />}
      </div>)}
    </div>
  </div>
}
