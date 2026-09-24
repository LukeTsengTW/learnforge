import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NotFoundPage, QuizErrorPage } from './components/ErrorPage'
import { AttemptProvider } from './features/quiz/AttemptProvider'
import { demoQuiz } from './features/quiz/quiz-loader'
import { HomePage } from './pages/HomePage'
import { QuizPage } from './pages/QuizPage'
import { ResultPage } from './pages/ResultPage'

export default function App() {
  return <HashRouter>{demoQuiz.ok ? <AttemptProvider quiz={demoQuiz.quiz}>
    <Routes><Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="quiz/demo" element={<QuizPage />} />
      <Route path="result/demo" element={<ResultPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route></Routes>
  </AttemptProvider> : <QuizErrorPage detail={demoQuiz.error} />}</HashRouter>
}
