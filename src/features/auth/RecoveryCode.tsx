import { useState } from 'react'
export function RecoveryCode({ code, onSaved }: { code: string; onSaved: () => void }) {
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('')
  return <section className="recovery-code" aria-labelledby="recovery-code-title">
    <h2 id="recovery-code-title">保存帳號復原碼</h2>
    <p>請保存此復原碼；離開頁面後 LearnForge 無法再次顯示。</p>
    <p>它可以重設你的密碼。請像密碼一樣保管；不要分享或貼到 issue。</p>
    <code className="recovery-secret">{code}</code>
    <div className="button-row"><button type="button" className="button secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setNotice('已複製，請保存到安全的位置。') }
      catch { setNotice('無法複製，請手動選取復原碼或下載。') }
    }}>複製復原碼</button><button type="button" className="button secondary" onClick={() => {
      const url = URL.createObjectURL(new Blob([`LearnForge account recovery code\n${code}\nKeep private. Single use.\n`], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a'); link.href = url; link.download = 'learnforge-recovery-code.txt'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }}>下載文字檔</button></div>
    <p role="status">{notice}</p>
    <label className="check-label"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />我已保存復原碼</label>
    <button type="button" className="button primary" disabled={!saved} onClick={onSaved}>繼續</button>
  </section>
}
