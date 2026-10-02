import { describe, expect, it } from 'vitest'
import { mapAnalyticsRecord } from '../quiz/practice-repository'
import type { JudgmentRow, RubricJudgmentRow } from '../quiz/repositories'
import { submittedV4Rows, v4Catalog } from '../quiz/practice-v4.test-helper'
import { buildLearningAnalytics } from './learning-analytics'

function analyticsRecord(fixture = submittedV4Rows()) {
  return mapAnalyticsRecord(fixture.row as never, fixture.row.answers as never, 'student', v4Catalog,
    fixture.fill as unknown as JudgmentRow[], fixture.rubric as unknown as RubricJudgmentRow[])
}

describe('M5 analytics for ai-grading-v4', () => {
  it('counts v4 explicitly, includes rubric scores overall and keeps objective accuracy objective-only', () => {
    const analytics = buildLearningAnalytics([analyticsRecord()], false, () => null)
    expect(analytics.gradingVersionCounts).toEqual({ deterministicV1: 0, semanticFillV2: 0, aiGradingV3: 0, aiGradingV4: 1 })
    expect(analytics.totalScoreEarned).toBe(5.8)
    expect(analytics.totalScoreAvailable).toBe(12)
    // Objective statistics use only single/multiple/true-false/fill (q_single incorrect, q_fill correct).
    expect(analytics).toMatchObject({ objectiveQuestions: 2, correct: 1, incorrect: 1, answeredAccuracy: 0.5,
      objectivePointsEarned: 1, objectivePointsAvailable: 2, malformedAttemptCount: 0 })
    expect(analytics.questionTypes.map((type) => type.questionType)).toEqual(['single', 'multiple', 'true-false', 'fill'])
  })

  it('puts v4 objective mistakes in the review queue but never calculation/drawing rubric questions', () => {
    const analytics = buildLearningAnalytics([analyticsRecord()], false, () => null)
    expect(analytics.reviewQueue.map((item) => item.questionId)).toEqual(['q_single'])
    expect(analytics.reviewQueue[0].latestStudentAnswer).toEqual({ type: 'single', optionId: 'a' })
  })

  it('excludes malformed or incomplete v4 records through the existing malformed accounting', () => {
    const bad = submittedV4Rows()
    bad.rubric[1].criteria[0].awardedScore = 0.123456789
    const malformed = analyticsRecord(bad)
    expect(malformed.unavailableReason).toBe('malformed')
    const withoutAnswers = { ...analyticsRecord(), answersV4: undefined }
    const analytics = buildLearningAnalytics([malformed, withoutAnswers], false, () => null)
    expect(analytics.malformedAttemptCount).toBe(2)
    expect(analytics.gradingVersionCounts.aiGradingV4).toBe(0)
    expect(analytics.gradingVersionCounts.aiGradingV3).toBe(0)
    expect(analytics.reviewQueue).toEqual([])
  })
})
