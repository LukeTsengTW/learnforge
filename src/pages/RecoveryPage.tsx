import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { usePracticeRepository } from '../features/quiz/practice-context'
import { listPracticeBackups, readBackup, restorePracticeBackup, type PracticeBackup } from '../features/quiz/practice-recovery'
export function RecoveryPage() {
  const { account } = useAuth(), repo = usePracticeRepository()
  const [backups, setBackups] = useState<PracticeBackup[]>([]), [notice, setNotice] = useState('')
  const [view, setView] = useState<{ key: string; raw: string } | null>(null), [restored, setRestored] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => {
    if (!account) return
    try { setBackups(listPracticeBackups(account.id, localStorage)) }
    catch { setNotice('無法讀取此瀏覽器的儲存空間。') }
  }, [account])
  useEffect(() => { queueMicrotask(refresh); window.addEventListener('storage', refresh); return () => window.removeEventListener('storage', refresh) }, [refresh])
  function raw(backup: PracticeBackup) { if (!account) throw new Error('Unauthenticated'); return readBackup(account.id, backup.key, localStorage) }
  return <section className="recovery-page"><span className="subject-label">LEARNFORGE · LOCAL BACKUPS</span><h1>本機練習備份</h1>
    <p>這些是此裝置的同步衝突備份，與密碼復原碼不同。只顯示目前帳號的資料。</p>
    <p>還原需要連線、雲端版本一致，且雲端與本機草稿都沒有既有答案。其餘情況請匯出保存。</p>
    {notice && <p className="notice" role="status">{notice}</p>}{restored && <Link to={`/quiz/${restored}`}>開啟還原的本機草稿</Link>}
    {!backups.length && <p>此帳號在本裝置沒有練習備份。</p>}
    <ul className="backup-list">{backups.map(backup => <li className="account-section" key={backup.key}><h2>{backup.quizId}</h2>
      <p>作答 {backup.attemptId.slice(0, 8)} · {backup.savedAt && Number.isFinite(Date.parse(backup.savedAt)) ? new Date(backup.savedAt).toLocaleString() : '時間未知'}</p><p>{backup.reason}</p>
      <div className="button-row"><button className="button secondary" onClick={() => { try { setView({ key: backup.key, raw: raw(backup) }) } catch { setNotice('備份無法讀取。') } }}>檢視</button>
        <button className="button secondary" onClick={() => {
          try { const url = URL.createObjectURL(new Blob([raw(backup)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'learnforge-practice-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
          catch { setNotice('無法匯出備份。') }
        }}>匯出 JSON</button>
        <button className="button secondary" disabled={busy} onClick={async () => {
          if (!account) return
          setBusy(true); setRestored('')
          try { setRestored(await restorePracticeBackup(account.id, backup.key, localStorage, repo)); setNotice('已還原為本機草稿。原始備份仍保留；開啟草稿後才會嘗試同步。') }
          catch { setNotice('此備份無法安全還原：請匯出保存。既有作答與雲端資料未被覆蓋。') } finally { setBusy(false) }
        }}>嘗試安全還原為本機草稿</button>
        <button className="button secondary" onClick={() => {
          if (!window.confirm('確定刪除此裝置上的這份練習備份？此操作無法復原。')) return
          try { raw(backup); localStorage.removeItem(backup.key); setView(null); refresh() } catch { setNotice('無法刪除備份。') }
        }}>刪除備份</button></div>
      {view?.key === backup.key && <><p>以下是此備份的原始內容，可能含你的作答。請勿公開分享。</p><pre className="backup-preview">{view.raw}</pre><button className="button secondary" onClick={() => setView(null)}>收起內容</button></>}
    </li>)}</ul><Link to="/account">返回帳號</Link>
  </section>
}
