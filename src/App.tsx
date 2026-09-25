import { useMemo, type ReactNode } from 'react'
import { HashRouter, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NotFoundPage, QuizErrorPage } from './components/ErrorPage'
import { AttemptProvider } from './features/quiz/AttemptProvider'
import { demoQuiz } from './features/quiz/quiz-loader'
import { HomePage } from './pages/HomePage'
import { QuizPage } from './pages/QuizPage'
import { ResultPage } from './pages/ResultPage'
import { CloudAttemptProvider } from './features/quiz/CloudAttemptProvider'
import { AuthPage } from './pages/AuthPage'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/auth-context'
import { createAuthService, type AuthService } from './features/auth/auth-service'
import { RequireAuth } from './features/auth/RequireAuth'
import { getSupabase } from './lib/supabase'
import { SupabaseAttemptRepository, type AttemptRepository } from './features/quiz/repositories'
import type { Quiz } from './models/quiz'

function QuizRoute({ result = false }: { result?: boolean }) {
  const { quizId } = useParams()
  return quizId === 'demo' ? result ? <ResultPage /> : <QuizPage /> : <NotFoundPage />
}
export function AppRoutes() {
  return <Routes><Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="login" element={<AuthPage key="login" mode="login" />} />
      <Route path="register" element={<AuthPage key="register" mode="register" />} />
      <Route path="forgot-password" element={<AuthPage key="hint" mode="hint" />} />
      <Route element={<RequireAuth />}><Route path="quiz/:quizId" element={<QuizRoute />} /><Route path="result/:quizId" element={<QuizRoute result />} /></Route>
      <Route path="*" element={<NotFoundPage />} />
    </Route></Routes>
}
export type RepositoryFactory = (quiz: Quiz, userId: string) => AttemptRepository
function PersistenceBoundary({ createRepository, children }: { createRepository: RepositoryFactory; children: ReactNode }) {
  const { account } = useAuth()
  const repository = useMemo(() => account && demoQuiz.ok ? createRepository(demoQuiz.quiz, account.id) : null, [account, createRepository])
  if (!demoQuiz.ok) return <QuizErrorPage detail={demoQuiz.error} />
  return account && repository ? <CloudAttemptProvider key={account.id} quiz={demoQuiz.quiz} userId={account.id} repository={repository}>{children}</CloudAttemptProvider>
    : <AttemptProvider key="public" quiz={demoQuiz.quiz}>{children}</AttemptProvider>
}
export function Application({ auth, createRepository }: { auth: AuthService | null; createRepository: RepositoryFactory }) {
  return <HashRouter><AuthProvider service={auth}><PersistenceBoundary createRepository={createRepository}><AppRoutes /></PersistenceBoundary></AuthProvider></HashRouter>
}
export default function App() {
  const config = getSupabase()
  const auth = useMemo(() => config.client ? createAuthService(config.client) : null, [config.client])
  const createRepository = useMemo<RepositoryFactory>(() => (quiz, userId) => {
    if (!config.client) throw new Error('Missing configuration')
    return new SupabaseAttemptRepository(config.client, quiz, userId)
  }, [config.client])
  if (config.error) return <main className="error-page"><h1>LearnForge</h1><p role="alert">{config.error}</p></main>
  return <Application auth={auth} createRepository={createRepository} />
}
