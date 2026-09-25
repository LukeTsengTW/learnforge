import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { NotFoundPage } from '../../components/ErrorPage'
import { QuizPage } from '../../pages/QuizPage'
import { quizCatalog } from './quiz-loader'
import { usePracticeRepository } from './practice-context'
import { LocalPracticeCache } from './practice-cache'
import { AttemptContext } from './attempt-context'
import { createPracticeStore } from './practice-store'
import type { PracticeRecord } from './practice-repository'

function PracticeAttemptProvider({ record, onReplace, children }: {
  record: PracticeRecord; onReplace: (record: PracticeRecord) => void; children: ReactNode
}) {
  const { account } = useAuth()
  const repo = usePracticeRepository()
  const [store] = useState(() => createPracticeStore(record, repo, new LocalPracticeCache(account!.id)))
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    store.start()
    const online = () => { void store.retry() }
    window.addEventListener('online', online)
    return () => { store.stop(); window.removeEventListener('online', online) }
  }, [store])
  if (!record.quiz) return null
  return <AttemptContext.Provider value={{ quiz: record.quiz, attempt: state.attempt, attemptId: state.attemptId,
    storageNotice: state.notice, syncing: state.syncing, pendingSubmission: state.pendingSubmission, retry: store.retry,
    importLegacy: state.legacy ? store.importLegacy : undefined,
    answerQuestion: store.answer, submit: store.submit,
    restart: async () => {
      if (!await store.deleteDraft()) return false
      try {
        const current = quizCatalog.getCurrentQuiz(record.row.quiz_id)
        if (!current) return false
        onReplace(await repo.getOrCreateDraft(current)); return true
      } catch { return false }
    },
  }}>{children}</AttemptContext.Provider>
}

export function PracticeQuizRoute() {
  const { quizId } = useParams()
  const repo = usePracticeRepository()
  const current = quizId ? quizCatalog.getCurrentQuiz(quizId) : null
  const [state, setState] = useState<{ quizId: string; record: PracticeRecord | null; error: boolean } | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  useEffect(() => {
    if (!current) return
    let active = true
    void repo.getOrCreateDraft(current).then((record) => {
      if (active) setState({ quizId: current.id, record, error: false })
    }).catch(() => { if (active) setState({ quizId: current.id, record: null, error: true }) })
    return () => { active = false }
  }, [repo, current])
  if (!current) return <NotFoundPage />
  if (!state || state.quizId !== current.id) return <p role="status">正在載入草稿…</p>
  if (state.error || !state.record) return <div className="empty-state"><h1>暫時無法載入草稿</h1>
    <p>請確認網路連線，再重新整理頁面。</p><Link to="/library" className="button secondary">返回題庫</Link></div>
  if (!state.record.quiz || !state.record.attempt) return <div className="empty-state"><h1>題目版本無法載入</h1>
    <p>這份草稿使用 {state.record.row.quiz_revision} 版題目；目前無法安全解讀答案。</p>
    {!confirmDiscard ? <button className="button secondary" onClick={() => setConfirmDiscard(true)}>捨棄草稿並使用最新版</button>
      : <div className="notice warning"><p>只會刪除這份未完成草稿。確定嗎？</p><button className="button primary" onClick={async () => {
        try { await repo.deleteDraft(state.record!); setState({ quizId: current.id, record: await repo.getOrCreateDraft(current), error: false }) }
        catch { setState({ quizId: current.id, record: null, error: true }) }
      }}>確認捨棄</button><button className="button secondary" onClick={() => setConfirmDiscard(false)}>保留草稿</button></div>}
  </div>
  return <PracticeAttemptProvider key={state.record.id} record={state.record}
    onReplace={(record) => setState({ quizId: current.id, record, error: false })}><QuizPage /></PracticeAttemptProvider>
}
