import { Markdown } from '../../components/Markdown'
import { QuestionCard } from '../quiz/QuestionCard'
import { ResultQuestion } from '../quiz/ResultQuestion'
import { gradeQuiz } from '../../lib/grading'
import type { AnswerMap } from '../../models/attempt'
import type { PracticeAnswerMap, PracticeAnswer } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'
import { isLegacyQuestionAnswer, requiresV4Draft } from '../../lib/draft-v4'

export function AuthorPreview({ quiz, mode, answers, onAnswer }: {
  quiz: Quiz
  mode: 'student' | 'answer'
  answers: PracticeAnswerMap
  onAnswer: (questionId: string, answer: PracticeAnswer) => void
}) {
  const draftSchema = requiresV4Draft(quiz) ? 2 : 1
  // Local preview grading only needs legacy objective answers. Calculations remain
  // manual; ResultQuestion receives the original value and displays its active mode.
  const gradingAnswers: AnswerMap = {}
  if (mode === 'answer') {
    for (const [id, answer] of Object.entries(answers)) {
      if (isLegacyQuestionAnswer(answer)) gradingAnswers[id] = answer
    }
  }
  const grades = mode === 'answer' ? gradeQuiz(quiz, gradingAnswers).questions : []
  return <div className="author-preview-content">
    <header className="page-heading"><span className="subject-label">{quiz.subject}</span>
      <h2>{quiz.title}</h2><Markdown>{quiz.description}</Markdown></header>
    <div className="question-stack">
      {quiz.questions.map((question, index) => <div id={`author-question-${question.id}`} key={question.id}>
        {mode === 'student'
          ? <QuestionCard question={question} index={index} answer={answers[question.id]} draftSchema={draftSchema}
            onChange={(answer) => onAnswer(question.id, answer)} />
          : <ResultQuestion question={question} index={index} answer={answers[question.id]}
            grade={grades[index]} idPrefix="author-" />}
      </div>)}
    </div>
  </div>
}
