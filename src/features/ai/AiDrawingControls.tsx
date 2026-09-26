import { useMemo } from 'react'
import { Markdown } from '../../components/Markdown'
import type { DrawingQuestion } from '../../models/quiz'
import type { QuestionAnswer } from '../../models/attempt'
import { isMeaningfullyNonBlank, parseStoredDrawing, rasterDrawingPixels } from '../../../supabase/functions/_shared/drawing-raster'
import type { AiTutorState } from './use-ai-tutor'
import { hasScoredRubric } from '../../lib/scored-rubric'

const STATUS = { full: '完整符合', partial: '部分符合', none: '未符合' }
const CONFIDENCE = { high: '高', medium: '中', low: '低' }

export function AiDrawingControls({ tutor, question, answer }: {
  tutor: AiTutorState; question: DrawingQuestion; answer: QuestionAnswer | undefined
}) {
  const visible = useMemo(() => {
    if (answer?.type !== 'drawing') return false
    try {
      const strokes = parseStoredDrawing(answer, question.drawing)
      return isMeaningfullyNonBlank(rasterDrawingPixels(question.drawing, strokes),
        question.drawing.width, question.drawing.height)
    } catch { return false }
  }, [answer, question.drawing])
  if (!tutor.enabled || answer?.type !== 'drawing') return null
  const rubricAvailable = hasScoredRubric(question)
  const state = tutor.drawingState(question.id)
  const response = state.response
  const quota = tutor.quota
  const canRequest = visible && rubricAvailable && !tutor.restoring && !tutor.restoreError && quota
    && quota.remaining >= quota.featureCosts.drawing_analysis
  return <section className="ai-grading ai-drawing" aria-labelledby={`ai-drawing-${question.id}`}>
    <h3 id={`ai-drawing-${question.id}`}>AI 圖像參考分析</h3>
    <p className="ai-grading-disclaimer">AI 圖像分析僅供學習參考，可能誤判線條、文字或連接關係；請以題目解析與教師判斷為準。</p>
    {!rubricAvailable && <p role="status">此題未提供可量化評分規準，因此無法使用 AI 圖像分析。</p>}
    {rubricAvailable && !visible && <p role="status">這道題尚未提供可分析的繪圖內容。</p>}
    {rubricAvailable && visible && <>
      {state.kind === 'loading' && <p role="status">AI 正在依評分規準分析圖像…</p>}
      {(state.kind === 'pending' || state.kind === 'retryable') && <button type="button" className="button secondary"
        onClick={() => { void tutor.runDrawing(question.id) }}>重試取得前次分析</button>}
      {state.kind !== 'loading' && state.kind !== 'pending' && state.kind !== 'retryable' && canRequest &&
        <button type="button" className="button secondary"
          onClick={() => { void tutor.runDrawing(question.id, !!response) }}>
          {response ? '重新分析 · 4 credits' : '取得 AI 圖像參考分析 · 4 credits'}
        </button>}
      {'message' in state && state.message && <p className="ai-tutor-error" role="alert" aria-live="polite">{state.message}</p>}
      {response?.outcome === 'refusal' && <p role="status">{response.message}</p>}
      {response?.outcome === 'analyzed' && <div className="ai-grading-result" aria-live="polite">
        <p className="ai-grading-score">AI 建議分數：<strong>{response.overallScore} / {response.maxScore}</strong></p>
        <ol className="ai-grading-criteria" aria-label="逐項圖像參考評估">
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
        {response.observations.length > 0 && <div className="ai-grading-feedback"><h4>觀察到的元素</h4>
          <ul>{response.observations.map((item, index) => <li key={index}><Markdown>{item}</Markdown></li>)}</ul></div>}
        {response.missingOrUnclear.length > 0 && <div className="ai-grading-feedback"><h4>缺少或不清楚的部分</h4>
          <ul>{response.missingOrUnclear.map((item, index) => <li key={index}><Markdown>{item}</Markdown></li>)}</ul></div>}
        <div className="ai-grading-feedback"><h4>整體回饋</h4><Markdown>{response.summary}</Markdown></div>
        <p className="ai-grading-confidence">AI 自述分析把握程度：{CONFIDENCE[response.confidence]}。
          {response.requiresManualReview && ' 建議人工覆核。'}</p>
      </div>}
    </>}
  </section>
}
