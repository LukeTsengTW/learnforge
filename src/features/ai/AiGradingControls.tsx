import { Markdown } from '../../components/Markdown'
import type { CalculationQuestion } from '../../models/quiz'
import type { QuestionAnswer } from '../../models/attempt'
import type { AiTutorState } from './use-ai-tutor'
import { hasScoredRubric } from '../../lib/scored-rubric'

const STATUS = { full: '已達成', partial: '部分達成', none: '未達成' }
const CONFIDENCE = { high: '高', medium: '中', low: '低' }
const MAX_BYTES = 8192

export function AiGradingControls({ tutor, question, answer }: {
  tutor: AiTutorState; question: CalculationQuestion; answer: QuestionAnswer | undefined
}) {
  if (!tutor.enabled || answer?.type !== 'calculation' || !answer.text.trim()) return null
  const rubricAvailable = hasScoredRubric(question)
  const answerTooLong = new TextEncoder().encode(answer.text).length > MAX_BYTES
  const state = tutor.gradingState(question.id)
  const response = state.response
  const quota = tutor.quota
  const canRequest = !tutor.restoring && !tutor.restoreError && quota
    && quota.remaining >= quota.featureCosts.calculation_grading
  return <section className="ai-grading" aria-labelledby={`ai-grading-${question.id}`}>
    <h3 id={`ai-grading-${question.id}`}>AI 參考評分</h3>
    <p className="ai-grading-disclaimer">AI 參考評分僅供學習使用，請以教師或題目正式評分規準為準。</p>
    {!rubricAvailable && <p role="status">此題未提供可量化評分規準，因此無法使用 AI 參考評分。</p>}
    {rubricAvailable && answerTooLong && <p role="status">此作答內容過長，暫時無法使用 AI 參考評分。</p>}
    {rubricAvailable && !answerTooLong && <>
      {state.kind === 'loading' && <p role="status">AI 正在依評分規準檢查作答…</p>}
      {state.kind === 'pending' && <button type="button" className="button secondary"
        onClick={() => { void tutor.runGrading(question.id) }}>重試取得前次評分</button>}
      {state.kind === 'retryable' && <button type="button" className="button secondary"
        onClick={() => { void tutor.runGrading(question.id) }}>重試取得前次評分</button>}
      {state.kind !== 'loading' && state.kind !== 'pending' && state.kind !== 'retryable' && canRequest &&
        <button type="button" className="button secondary"
          onClick={() => { void tutor.runGrading(question.id, !!response) }}>
          {response ? '重新評分 · 2 credits' : '取得 AI 參考評分 · 2 credits'}
        </button>}
      {'message' in state && state.message && <p className="ai-tutor-error" role="alert" aria-live="polite">{state.message}</p>}
      {response?.outcome === 'refusal' && <p role="status">{response.message}</p>}
      {response?.outcome === 'graded' && <div className="ai-grading-result" aria-live="polite">
        <p className="ai-grading-score">AI 建議分數：<strong>{response.overallScore} / {response.maxScore}</strong></p>
        <ol className="ai-grading-criteria" aria-label="逐項參考評分">
          {question.rubric.map((criterion, index) => {
            const item = response.criteria.find((entry) => entry.criterionId === `r${index + 1}`)
            if (!item) return null
            return <li key={item.criterionId}>
              <div className="ai-grading-criterion-heading"><strong>{STATUS[item.status]} · <Markdown inline>{criterion.description}</Markdown></strong>
                <span>{item.awardedScore} / {item.maxScore}</span></div>
              <div><span className="sr-only">回饋：</span><Markdown>{item.feedback}</Markdown></div>
            </li>
          })}
        </ol>
        <div className="ai-grading-feedback"><h4>整體回饋</h4><Markdown>{response.summary}</Markdown></div>
        {response.strengths.length > 0 && <div className="ai-grading-feedback"><h4>做得好的地方</h4>
          <ul>{response.strengths.map((item, index) => <li key={index}><Markdown>{item}</Markdown></li>)}</ul></div>}
        {response.improvements.length > 0 && <div className="ai-grading-feedback"><h4>可改進部分</h4>
          <ul>{response.improvements.map((item, index) => <li key={index}><Markdown>{item}</Markdown></li>)}</ul></div>}
        <p className="ai-grading-confidence">AI 自述評分把握程度：{CONFIDENCE[response.confidence]}。
          {response.requiresManualReview && ' 建議人工覆核。'}</p>
      </div>}
    </>}
  </section>
}
