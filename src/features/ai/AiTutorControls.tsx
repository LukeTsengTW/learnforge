import { Markdown } from '../../components/Markdown'
import type { TutorFeature } from './tutor-service'
import type { AiTutorState } from './use-ai-tutor'

const LABEL: Record<TutorFeature, string> = {
  hint: 'AI 提示', explain_mistake: 'AI 解釋我錯在哪', explain_solution: 'AI 換個方式解釋',
}
export function AiQuotaStatus({ tutor }: { tutor: AiTutorState }) {
  if (!tutor.enabled) return null
  return <section className="ai-quota" aria-label="AI 學習輔助額度">
    {tutor.quota ? <p>AI 額度 <strong>{tutor.quota.remaining} / {tutor.quota.limit}</strong> · 5 小時滾動額度</p>
      : <p role="status">{tutor.quotaLoading ? '正在載入 AI 額度…' : '目前無法取得 AI 額度。'}</p>}
    {tutor.quotaError && <button type="button" className="text-button" onClick={() => { void tutor.refreshQuota() }}>重試載入額度</button>}
    <p className="ai-disclaimer">AI 建議僅供學習參考，請以題目提供的答案與解析為主要依據。</p>
  </section>
}

export function AiTutorControls({ tutor, questionId, features, beforeRun }: {
  tutor: AiTutorState; questionId: string; features: readonly TutorFeature[];
  beforeRun?: () => Promise<void>
}) {
  if (!tutor.enabled) return null
  const available = features.filter((feature) => tutor.quota && tutor.quota.remaining >= tutor.quota.featureCosts[feature])
  const retries = features.filter((feature) => !available.includes(feature) && tutor.pending(feature, questionId)
    && tutor.error(feature, questionId))
  const visible = features.filter((feature) => tutor.result(feature, questionId) || tutor.error(feature, questionId))
  if (!available.length && !visible.length) return null
  return <div className="ai-tutor-actions">
    <div className="ai-tutor-buttons">{available.map((feature) => <button type="button" key={feature}
      className="button secondary" disabled={tutor.busy(feature, questionId)}
      onClick={() => { void tutor.run(feature, questionId, beforeRun) }}>
      {tutor.busy(feature, questionId) ? 'AI 正在產生說明…' : `${LABEL[feature]} · ${tutor.quota!.featureCosts[feature]} credit`}
    </button>)}{retries.map((feature) => <button type="button" key={`retry-${feature}`}
      className="button secondary" disabled={tutor.busy(feature, questionId)}
      onClick={() => { void tutor.run(feature, questionId) }}>
      {tutor.busy(feature, questionId) ? '正在取回前次說明…' : '重試取得前次說明'}
    </button>)}</div>
    {features.map((feature) => {
      const response = tutor.result(feature, questionId)
      const error = tutor.error(feature, questionId)
      return <div key={feature} aria-live="polite">
        {error && <p className="ai-tutor-error" role="alert">{error}</p>}
        {response && <section className="ai-tutor-response" aria-label={LABEL[feature]}>
          <h3>{response.title}</h3><Markdown>{response.message}</Markdown>
          {response.keyPoints.length > 0 && <ul>{response.keyPoints.map((point, index) => <li key={index}><Markdown>{point}</Markdown></li>)}</ul>}
          {response.nextStep && <div className="ai-next-step"><strong>下一步：</strong><Markdown>{response.nextStep}</Markdown></div>}
        </section>}
      </div>
    })}
  </div>
}
