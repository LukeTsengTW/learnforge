import { useEffect, useRef, useState } from 'react'
import { SUBMIT_STAGES, type SubmitProgress, type SubmitStage } from './attempt-context'

const STAGE_LABELS: Record<SubmitStage, string> = {
  save: '儲存最新作答到雲端',
  verify: '確認雲端草稿為最新版本',
  grade: '評分作答',
  result: '讀取評分結果',
}

function elapsedText(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Floating card shown while a formal submission runs, so a long AI grading wait never looks frozen.
 * It lists the submission steps with the finished ones checked; the elapsed time ticks every second
 * outside the live region, which announces only step changes. `aiGradedLabels` names the question
 * types of this quiz that may need AI grading (none: everything is graded by rule).
 */
export function SubmitProgressCard({ progress, answeredCount, questionCount, aiGradedLabels }: {
  progress: SubmitProgress | null | undefined; answeredCount: number; questionCount: number; aiGradedLabels: readonly string[]
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const current = progress ? SUBMIT_STAGES.indexOf(progress.stage) : -1
  const detail = (stage: SubmitStage) => stage === 'save' ? `已作答 ${answeredCount} / ${questionCount} 題`
    : stage === 'grade' ? progress?.waiting ? '這份作答已有評分正在進行，正在等待結果。'
      : aiGradedLabels.length ? `${aiGradedLabels.join('、')}可能需要 AI 逐題評分，題目較多時可能需要幾分鐘。` : '由系統自動評分。'
      : null
  return <section className="submit-progress" aria-labelledby="submit-progress-title">
    <div className="submit-progress-head"><h2 id="submit-progress-title">正在提交測驗</h2>
      {progress && <span className="submit-progress-time">已經過 {elapsedText(now - progress.startedAt)}</span>}</div>
    <p role="status" className="submit-progress-status">
      {progress ? `步驟 ${current + 1} / ${SUBMIT_STAGES.length}：${STAGE_LABELS[progress.stage]}${progress.waiting ? '（等待進行中的評分）' : ''}`
        : '正在提交…'}</p>
    {progress && <>
      <progress max={SUBMIT_STAGES.length} value={current + 0.5} aria-label="提交進度"
        aria-valuetext={`第 ${current + 1} 步，共 ${SUBMIT_STAGES.length} 步`} />
      <ol className="submit-steps">{SUBMIT_STAGES.map((stage, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'pending'
        const text = state === 'active' ? detail(stage) : null
        return <li key={stage} className={`submit-step is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
          <span className="submit-step-icon" aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
          <span className="submit-step-text">{STAGE_LABELS[stage]}{text && <small>{text}</small>}</span>
          <span className="submit-step-state">{state === 'done' ? '完成' : state === 'active' ? '進行中' : '等待'}</span>
        </li>
      })}</ol>
    </>}
    <p className="submit-progress-note">完成後會自動前往結果頁。請保持此頁面開啟，不要重新整理或關閉。</p>
  </section>
}

/**
 * Shown in the submit panel after a submission stopped without submitting. It takes focus when it
 * appears (scrolling it into view), because the control that started the submission is gone or disabled.
 */
export function SubmitStoppedCard({ notice, onDismiss }: { notice: string; onDismiss: () => void }) {
  const card = useRef<HTMLElement>(null)
  useEffect(() => { card.current?.focus() }, [])
  return <section ref={card} tabIndex={-1} className="notice warning submit-warning submit-stopped" aria-labelledby="submit-stopped-title"
    aria-describedby="submit-stopped-reason">
    <strong id="submit-stopped-title">提交未完成</strong><p id="submit-stopped-reason">{notice}</p>
    <div className="inline-actions"><button type="button" className="button secondary" onClick={onDismiss}>知道了</button></div>
  </section>
}
