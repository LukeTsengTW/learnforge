import { Link } from 'react-router-dom'
import { useAttempt } from '../features/quiz/attempt-context'
import { hasAnswer } from '../lib/grading'
import { isObjectiveQuestion } from '../models/quiz'

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
  const { quiz, attempt } = useAttempt()
  const answered = Object.values(attempt.answers).filter(hasAnswer).length
  const objective = quiz.questions.filter(isObjectiveQuestion)
  const submitted = attempt.status === 'submitted'
  return <div className="home-page">
    <section className="home-intro"><div>
      <div className="section-kicker"><span className="small-rule" /> 自主學習，從練習開始</div>
      <h1>把理解，<br />練成自己的。</h1>
      <p className="intro-copy">留一點時間給思考。從選擇、推導到畫圖，<br className="desktop-break" />一步步確認你學會了什麼。</p>
      <div className="intro-note"><span aria-hidden="true">✓</span> 不需登入 <span className="note-divider" /> 進度保存在這台裝置</div>
    </div><LogicIllustration /></section>
    <section className="practice-section" aria-labelledby="practice-heading">
      <div className="section-heading"><h2 id="practice-heading">開始你的練習</h2><span>一份測驗，六種思考方式</span></div>
      <article className="demo-card">
        <div className="demo-art" aria-hidden="true"><span>01</span><span className="demo-equation">x² − 5x + 6</span><span className="demo-subject">邏輯 × 數學</span></div>
        <div className="demo-content"><span className="subject-label">基礎練習</span><h3>{quiz.title}</h3>
          <p>辨認邏輯閘、練習 Boolean 運算，再用方程式與手繪整理你的思路。</p>
          <div className="quiz-facts"><span>{quiz.questions.length} 道題目</span><span>{objective.length} 題自動評分</span><span>{quiz.questions.length - objective.length} 題自行對照</span></div>
          <div className="card-bottom"><span className="progress-note">{submitted ? '已完成測驗，可以查看解答' : answered ? `已完成 ${answered} / ${quiz.questions.length} 題，繼續上次的練習` : '依自己的步調，不限作答時間'}</span>
            <Link className="button primary" to={submitted ? `/result/${quiz.id}` : `/quiz/${quiz.id}`}>{submitted ? '查看測驗結果' : answered ? '繼續練習' : '開始練習'}<span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </article>
    </section>
    <section className="home-guidance" aria-label="練習方式">
      <div><span className="guidance-icon" aria-hidden="true">?</span><div><h3>先想一想，再看提示</h3><p>卡住時打開提示，留給自己一次嘗試的機會。</p></div></div>
      <div><span className="guidance-icon" aria-hidden="true">✓</span><div><h3>讓解答成為下一步</h3><p>提交後查看答案與解析，找出還沒理解的地方。</p></div></div>
    </section>
  </div>
}
