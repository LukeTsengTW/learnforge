import { Markdown } from '../../components/Markdown'
import { GRADE_STATUS, type GradingVersion, type QuestionGrade } from '../../models/attempt'
import type { PracticeAnswer } from '../../models/draft-v4'
import { isLegacyQuestionAnswer } from '../../lib/draft-v4'
import { QUESTION_LABEL, QUESTION_TYPE, type Question } from '../../models/quiz'
import { hasAnswer } from '../../lib/grading'
import { isOfficialRubricVersion } from '../../models/grading-version'
import { DrawingPreview } from './DrawingPreview'
import { MANUAL_NOTICE } from './QuestionInput'
import { AiTutorControls } from '../ai/AiTutorControls'
import type { AiTutorState } from '../ai/use-ai-tutor'
import type { TutorFeature } from '../ai/tutor-service'
import { AiGradingControls } from '../ai/AiGradingControls'
import { AiDrawingControls } from '../ai/AiDrawingControls'

const STATUS_LABEL = {
  [GRADE_STATUS.correct]: '✓ 正確', [GRADE_STATUS.partial]: '△ 部分得分', [GRADE_STATUS.incorrect]: '✕ 錯誤',
  [GRADE_STATUS.unanswered]: '− 未作答', [GRADE_STATUS.manual]: '自行對照',
}

function StudentAnswer({ question, answer }: { question: Question; answer: PracticeAnswer | undefined }) {
  if (!answer || !hasAnswer(answer)) return <p className="muted">未作答</p>
  if (answer.type === 'drawing' && question.type === 'drawing') return <DrawingPreview config={question.drawing} strokes={answer.strokes} id={question.id} />
  if (answer.type === 'calculation' && answer.mode === 'drawing') {
    // Handwritten calculation: render ONLY the active strokes with the exact calculation drawing config.
    if (question.type !== 'calculation' || !question.drawing) return <p className="muted">手寫作答無法顯示。</p>
    return <div className="student-calculation student-handwriting">
      <DrawingPreview config={question.drawing} strokes={answer.strokes} id={question.id} /></div>
  }
  // Text mode (or historical legacy text): only the active text is shown; inactive strokes are never exposed.
  if (answer.type === 'calculation') return <div className="student-calculation"><Markdown>{answer.text}</Markdown></div>
  // Fill strings are literal answers; Markdown syntax must not disguise mismatches.
  if (answer.type === 'fill') return <p className="literal-answer">{answer.text}</p>
  if (answer.type === 'true-false') return <p>{answer.value ? '正確（True）' : '錯誤（False）'}</p>
  if ((question.type === 'single' || question.type === 'multiple') && (answer.type === 'single' || answer.type === 'multiple')) {
    const selected = answer.type === 'single' ? [answer.optionId] : answer.optionIds
    return <ul className="answer-options">{question.options.filter((option) => selected.includes(option.id)).map((option) =>
      <li key={option.id}><span className="option-letter">{option.id.toUpperCase()}</span><Markdown>{option.content}</Markdown></li>)}</ul>
  }
  return <p className="muted">未作答</p>
}

function CorrectAnswer({ question }: { question: Question }) {
  switch (question.type) {
    case QUESTION_TYPE.single:
    case QUESTION_TYPE.multiple: {
      const correct = question.type === 'single' ? [question.correctOptionId] : question.correctOptionIds
      return <ul className="answer-options">{question.options.filter((option) => correct.includes(option.id)).map((option) =>
        <li key={option.id}><span className="option-letter">{option.id.toUpperCase()}</span><Markdown>{option.content}</Markdown></li>)}</ul>
    }
    case QUESTION_TYPE.trueFalse: return <p>{question.correctAnswer ? '正確（True）' : '錯誤（False）'}</p>
    case QUESTION_TYPE.fill: return <Markdown>{question.correctAnswer}</Markdown>
    case QUESTION_TYPE.calculation:
    case QUESTION_TYPE.drawing: return <Markdown>{question.referenceAnswer}</Markdown>
  }
}

export function ResultQuestion({ question, answer, grade, index, idPrefix = '', aiTutor, gradingVersion }: {
  question: Question; answer: PracticeAnswer | undefined; grade: QuestionGrade; index: number; idPrefix?: string
  aiTutor?: AiTutorState; gradingVersion?: GradingVersion
}) {
  const isOfficialRubric = isOfficialRubricVersion(gradingVersion)
  const manual = grade.status === GRADE_STATUS.manual
  const officialRubricGrade = isOfficialRubric && (grade.type === 'calculation' || grade.type === 'drawing')
    && (grade.status === GRADE_STATUS.correct || grade.status === GRADE_STATUS.partial || grade.status === GRADE_STATUS.incorrect)
    && grade.source === 'ai'
    ? grade : null
  const handwriting = answer?.type === 'calculation' && answer.mode === 'drawing'
  // Personal advisory controls only exist for historical non-official versions and legacy answer shapes.
  const legacyAnswer = isLegacyQuestionAnswer(answer) ? answer : undefined
  const aiFeatures: TutorFeature[] = question.type === 'drawing' ? []
    : handwriting ? ['explain_solution']
      : grade.status === GRADE_STATUS.incorrect ? ['explain_mistake', 'explain_solution'] : ['explain_solution']
  return <section className="question-card result-question" aria-labelledby={`result-heading-${idPrefix}${question.id}`}>
    <div className="question-meta"><h2 id={`result-heading-${idPrefix}${question.id}`}><span className="question-number">{String(index + 1).padStart(2, '0')}</span>{QUESTION_LABEL[question.type]}</h2>
      <div className="question-meta-right"><span className={`status-badge status-${grade.status}`}>{STATUS_LABEL[grade.status]}</span>
        {!manual && <span>{grade.score} / {grade.maxScore} 分</span>}</div>
    </div>
    <div className="question-prompt"><Markdown>{question.prompt}</Markdown></div>
    {grade.type === 'fill' && grade.source && <p className="field-note">{grade.source === 'ai' ? 'AI 語意判定' : '規則判定'}
      {grade.source === 'ai' && grade.reason ? `：${grade.reason}` : ''}</p>}
    {manual && !isOfficialRubric && <p className="manual-notice">{question.type === 'calculation'
      ? '計算題不納入自動評分。以下 AI 參考評分如有提供，亦不會改變自動分數。' : MANUAL_NOTICE}</p>}
    <div className={`answer-comparison${question.type === 'drawing' ? ' drawing-comparison' : ''}`}>
      <div className="student-answer"><h3>你的答案</h3><StudentAnswer question={question} answer={answer} /></div>
      <div className="reference-answer"><h3>{manual || officialRubricGrade ? '參考答案' : '正確答案'}</h3><CorrectAnswer question={question} /></div>
    </div>
    <div className="solution-block"><h3>解題說明</h3><Markdown>{question.solution}</Markdown></div>
    {question.rubric.length > 0 && <div className="rubric-block"><h3>評分規準{manual && '（供自行對照）'}</h3><ul>
      {question.rubric.map((criterion, index) => <li key={index}><Markdown>{criterion.description}</Markdown>
        {criterion.score !== null && <span>{criterion.score} 分</span>}</li>)}
    </ul></div>}
    {officialRubricGrade && <section className="ai-grading-result" aria-label="AI 自動評分">
      <h3>AI 自動評分</h3>
      <p>{officialRubricGrade.score} / {officialRubricGrade.maxScore} 分 · 信心度：{officialRubricGrade.confidence}</p>
      <p>{officialRubricGrade.summary}</p>
      <ul>{officialRubricGrade.criteria.map((criterion, criterionIndex) => <li key={criterion.criterionId}>
        <strong>{question.rubric[criterionIndex]?.description ?? criterion.criterionId}</strong>
        <span>{criterion.awardedScore} / {criterion.maxScore} 分</span>
        {criterion.feedback && <p>{criterion.feedback}</p>}
      </li>)}</ul>
      {officialRubricGrade.type === 'calculation' && <>
        {!!officialRubricGrade.strengths?.length && <p>做得好的地方：{officialRubricGrade.strengths.join('、')}</p>}
        {!!officialRubricGrade.improvements?.length && <p>可以加強：{officialRubricGrade.improvements.join('、')}</p>}
      </>}
      {officialRubricGrade.type === 'drawing' && <>
        {!!officialRubricGrade.observations?.length && <p>圖中觀察：{officialRubricGrade.observations.join('、')}</p>}
        {!!officialRubricGrade.missingOrUnclear?.length && <p>缺少或不清楚：{officialRubricGrade.missingOrUnclear.join('、')}</p>}
      </>}
      <p className="score-note">AI 自動評分僅供學習參考，可能存在誤判。</p>
    </section>}
    {!isOfficialRubric && aiTutor && question.type === 'calculation' && <AiGradingControls tutor={aiTutor} question={question} answer={legacyAnswer} />}
    {!isOfficialRubric && aiTutor && question.type === 'drawing' && <AiDrawingControls tutor={aiTutor} question={question} answer={legacyAnswer} />}
    {aiTutor && aiFeatures.length > 0 && <AiTutorControls tutor={aiTutor} questionId={question.id} features={aiFeatures} />}
  </section>
}
