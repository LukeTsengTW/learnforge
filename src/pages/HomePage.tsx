import { Link } from 'react-router-dom'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { useDrafts } from '../features/quiz/use-drafts'
import { useAuth } from '../features/auth/auth-context'

function LogicIllustration() {
  return <div className="logic-illustration" aria-hidden="true">
    <svg viewBox="0 0 360 252" fill="none">
      <defs><pattern id="circuit-grid" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cedde7" /></pattern></defs>
      <rect width="360" height="252" rx="16" fill="url(#circuit-grid)" />
      <path d="M116 61H172C219 61 239 90 239 126S219 191 172 191H116Z" fill="white" stroke="#18334c" strokeWidth="3" />
      <path d="M46 98H116M46 154H116M239 126H312" stroke="#087e80" strokeWidth="3" />
      <circle cx="46" cy="98" r="5" fill="white" stroke="#087e80" strokeWidth="3" />
      <circle cx="46" cy="154" r="5" fill="white" stroke="#087e80" strokeWidth="3" />
      <circle cx="312" cy="126" r="5" fill="#087e80" />
      <g fill="#18334c" fontFamily="Georgia, serif" fontSize="20"><text x="39" y="78">A</text><text x="39" y="187">B</text><text x="305" y="106">Y</text><text x="150" y="134">AND</text></g>
      <text x="145" y="231" fill="#52677b" fontFamily="Georgia, serif" fontSize="18">Y = A · B</text>
    </svg>
    <span className="illustration-caption">從一個邏輯閘，開始理解。</span>
  </div>
}

export function HomePage() {
  const { account } = useAuth()
  const drafts = useDrafts()
  const firstDraft = drafts.find((draft) => quizCatalog.getQuizRevision(draft.quizId, draft.revision))
  const featured = quizCatalog.current[0]
  return <div className="home-page">
    <section className="home-intro"><div>
      <div className="section-kicker"><span className="small-rule" /> 自主學習，從練習開始</div>
      <h1>把理解，<br />練成自己的。</h1>
      <p className="intro-copy">留一點時間給思考。從選擇、推導到畫圖，<br className="desktop-break" />一步步確認你學會了什麼。</p>
      <div className="intro-note"><span aria-hidden="true">✓</span> 帳號同步 <span className="note-divider" /> 每一次提交都留在練習紀錄</div>
    </div><LogicIllustration /></section>
    <section className="practice-section" aria-labelledby="practice-heading">
      <div className="section-heading"><h2 id="practice-heading">選擇你的練習</h2><span>{quizCatalog.current.length} 份題庫，依自己的步調探索</span></div>
      <article className="demo-card">
        <div className="demo-art" aria-hidden="true"><span>01</span><span className="demo-equation">x² − 5x + 6</span><span className="demo-subject">探索 × 練習</span></div>
        <div className="demo-content"><span className="subject-label">題庫精選</span><h3>{featured?.quiz.title ?? 'LearnForge 題庫'}</h3>
          <p>{featured?.quiz.description ?? '從題庫選擇一份練習。'}</p>
          <div className="quiz-facts"><span>{featured?.questionCount ?? 0} 道題目</span><span>{featured?.maxPoints ?? 0} 分自動評分</span><span>可反覆練習</span></div>
          <div className="card-bottom"><span className="progress-note">草稿可繼續，提交後可在歷史紀錄回顧。</span>
            <Link className="button primary" to="/library">瀏覽題庫<span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </article>
      <div className="home-actions">{firstDraft && <Link className="button secondary" to={`/quiz/${firstDraft.quizId}`}>繼續練習：{quizCatalog.getQuizRevision(firstDraft.quizId, firstDraft.revision)?.title}</Link>}
        <Link className="button secondary" to="/history">練習紀錄</Link>
        {account && <><Link className="button secondary" to="/analytics">學習分析</Link>
          <Link className="button secondary" to="/review">錯題複習</Link></>}</div>
    </section>
    <section className="home-guidance" aria-label="練習方式">
      <div><span className="guidance-icon" aria-hidden="true">?</span><div><h3>先想一想，再看提示</h3><p>卡住時打開提示，留給自己一次嘗試的機會。</p></div></div>
      <div><span className="guidance-icon" aria-hidden="true">✓</span><div><h3>讓解答成為下一步</h3><p>提交後查看答案與解析，找出還沒理解的地方。</p></div></div>
    </section>
  </div>
}
