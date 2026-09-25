import type { QuestionAnswer, QuestionGrade } from '../../models/attempt'
import { isObjectiveQuestion, type ObjectiveQuestion } from '../../models/quiz'
import type { PracticeRecord } from './practice-repository'

export interface MistakeOccurrence {
  record: PracticeRecord
  question: ObjectiveQuestion
  answer: QuestionAnswer | undefined
  grade: QuestionGrade
  index: number
}

/** Canonical regraded answers, not persisted grade JSON, determine mistakes. */
export function deriveMistakes(records: PracticeRecord[]): MistakeOccurrence[] {
  const mistakes: MistakeOccurrence[] = []
  for (const record of records) {
    if (record.row.status !== 'submitted' || record.attempt?.status !== 'submitted' || !record.quiz) continue
    record.quiz.questions.forEach((question, index) => {
      const grade = record.attempt!.status === 'submitted' ? record.attempt!.result.questions[index] : null
      if (isObjectiveQuestion(question) && grade?.status === 'incorrect') {
        mistakes.push({ record, question, answer: record.attempt!.answers[question.id], grade, index })
      }
    })
  }
  return mistakes
}

export const formatAttemptDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '時間未提供'
