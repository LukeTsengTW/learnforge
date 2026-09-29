import type { QuestionAnswer, QuestionGrade } from '../../models/attempt'
import { isObjectiveQuestion, type Question } from '../../models/quiz'
import type { PracticeRecord } from './practice-repository'
import { GRADING_VERSION } from '../../models/grading-version'

export interface MistakeOccurrence {
  record: PracticeRecord
  question: Question
  answer: QuestionAnswer | undefined
  grade: QuestionGrade
  index: number
}

/** Reconstructed official grades determine mistakes; v3 evidence was loaded from immutable judgments. */
export function deriveMistakes(records: PracticeRecord[]): MistakeOccurrence[] {
  const mistakes: MistakeOccurrence[] = []
  for (const record of records) {
    if (record.row.status !== 'submitted' || record.attempt?.status !== 'submitted' || !record.quiz) continue
    record.quiz.questions.forEach((question, index) => {
      const grade = record.attempt!.status === 'submitted' ? record.attempt!.result.questions[index] : null
      const v3 = record.row.grading_version === GRADING_VERSION.aiGradingV3
      if (grade && ((isObjectiveQuestion(question) && grade.status === 'incorrect')
        || (v3 && (grade.status === 'incorrect' || grade.status === 'partial')))) {
        mistakes.push({ record, question, answer: record.attempt!.answers[question.id], grade, index })
      }
    })
  }
  return mistakes
}

export const formatAttemptDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '時間未提供'
