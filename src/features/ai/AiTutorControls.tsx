import { Markdown } from '../../components/Markdown'
import { Link } from 'react-router-dom'
import type { TutorFeature } from './tutor-service'
import type { AiTutorState } from './use-ai-tutor'

const LABEL: Record<TutorFeature, string> = {
  hint: 'AI 提示', explain_mistake: 'AI 解釋我錯在哪', explain_solution: 'AI 換個方式解釋',
}
export function AiQuotaStatus({ tutor }: { tutor: AiTutorState }) {
  if (!tutor.enabled) return null
  const quota = tutor.quota
  const minutes = quota?.remaining === 0 && quota.nextCreditAt
    ? Math.max(1, Math.ceil((Date.parse(quota.nextCreditAt) - Date.parse(quota.serverNow)) / 60_000)) : null
  const relative = minutes === null || !Number.isFinite(minutes) ? null
    : minutes >= 60 ? `約 ${Math.floor(minutes / 60)} 小時 ${minutes % 60} 分鐘後` : `約 ${minutes} 分鐘後`
  return <section className="ai-quota" aria-label="AI 學習輔助額度">
    {quota ? <><p>AI Tutor 額度 <strong>{quota.remaining} / {quota.limit}</strong> · 已用 {quota.used} · 5 小時滾動額度</p>
      {relative && <p role="status">目前 AI 額度已用完，最早將於{relative}恢復 1 credit。</p>}</>
      : <p role="status">{tutor.quotaLoading ? '正在載入 AI 額度…' : '目前無法取得 AI 額度。'}</p>}
    {tutor.quotaError && <button type="button" className="text-button" onClick={() => { void tutor.refreshQuota() }}>重試載入額度</button>}
    {tutor.restoring && <p role="status">正在載入先前的 AI 建議…</p>}
    {tutor.restoreError && <p role="alert">先前的 AI 建議暫時無法載入。
      <button type="button" className="text-button" onClick={() => { void tutor.restore() }}>重新檢查</button></p>}
    <Link to="/ai-usage">AI 使用紀錄</Link>
    <p className="ai-disclaimer">AI 建議僅供學習參考，請以題目提供的答案與解析為主要依據。</p>
  </section>
}

export function AiTutorControls({ tutor, questionId, features, beforeRun }: {
  tutor: AiTutorState; questionId: string; features: readonly TutorFeature[];
  beforeRun?: () => Promise<void>
}) {
  if (!tutor.enabled) return null
  const visible = features.some((feature) => {
    const state = tutor.state(feature, questionId)
    return state.response || ('message' in state && state.message) || state.kind === 'loading'
      || (tutor.quota && tutor.quota.remaining >= tutor.quota.featureCosts[feature])
  })
  if (!visible) return null
  return <div className="ai-tutor-actions">
    <div className="ai-tutor-buttons">{features.map((feature) => {
      const state = tutor.state(feature, questionId)
      if (state.kind === 'loading') return <button type="button" key={feature} className="button secondary" disabled>AI 正在產生說明…</button>
      if (state.kind === 'pending') return <button type="button" key={feature} className="button secondary"
        onClick={() => { void tutor.restore() }}>重新檢查</button>
      if (state.kind === 'retryable') return <button type="button" key={feature} className="button secondary"
        onClick={() => { void tutor.run(feature, questionId) }}>重試取得前次說明</button>
      if (tutor.restoring || tutor.restoreError || !tutor.quota || tutor.quota.remaining < tutor.quota.featureCosts[feature]) return null
      const regenerate = !!state.response
      const cost = tutor.quota.featureCosts[feature]
      const label = regenerate ? `重新產生 AI ${feature === 'hint' ? '提示' : '解釋'} · ${cost} ${cost === 1 ? 'credit' : 'credits'}`
        : `${LABEL[feature]} · ${cost} ${cost === 1 ? 'credit' : 'credits'}`
      return <button type="button" key={feature} className="button secondary"
        onClick={() => { void tutor.run(feature, questionId, beforeRun, regenerate) }}>{label}</button>
    })}</div>
    {features.map((feature) => {
      const state = tutor.state(feature, questionId)
      const response = state.response
      return <div key={feature} aria-live="polite">
        {'message' in state && state.message && <p className="ai-tutor-error" role={state.kind === 'pending' ? 'status' : 'alert'}>{state.message}</p>}
        {response && <section className="ai-tutor-response" aria-label={LABEL[feature]}>
          <span className="subject-label">AI 建議</span><h3>{response.title}</h3><Markdown>{response.message}</Markdown>
          {response.keyPoints.length > 0 && <ul>{response.keyPoints.map((point, index) => <li key={index}><Markdown>{point}</Markdown></li>)}</ul>}
          {response.nextStep && <div className="ai-next-step"><strong>下一步：</strong><Markdown>{response.nextStep}</Markdown></div>}
        </section>}
      </div>
    })}
  </div>
}
