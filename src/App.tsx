import { useMemo, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NotFoundPage } from './components/ErrorPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { HistoryPage } from './pages/HistoryPage'
import { MistakesPage } from './pages/MistakesPage'
import { ResultPage } from './pages/ResultPage'
import { AiUsagePage } from './pages/AiUsagePage'
import { PracticeQuizRoute } from './features/quiz/PracticeQuizRoute'
import { AuthPage } from './pages/AuthPage'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/auth-context'
import { createAuthService, type AuthService } from './features/auth/auth-service'
import { RequireAuth } from './features/auth/RequireAuth'
import { getSupabase } from './lib/supabase'
import { SupabasePracticeRepository } from './features/quiz/practice-repository'
import { PracticeContext, type PracticeRepository } from './features/quiz/practice-context'
import { TutorContext } from './features/ai/tutor-context'
import { SupabaseTutorService, type TutorService } from './features/ai/tutor-service'

export function AppRoutes() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="library" element={<LibraryPage />} />
    <Route path="login" element={<AuthPage key="login" mode="login" />} />
    <Route path="register" element={<AuthPage key="register" mode="register" />} />
    <Route path="forgot-password" element={<AuthPage key="hint" mode="hint" />} />
    <Route element={<RequireAuth />}>
      <Route path="quiz/:quizId" element={<PracticeQuizRoute />} />
      <Route path="result/:attemptId" element={<ResultPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="mistakes" element={<MistakesPage />} />
      <Route path="ai-usage" element={<AiUsagePage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes>
}

export type PracticeRepositoryFactory = (userId: string) => PracticeRepository
function PracticeBoundary({ createRepository, children }: { createRepository: PracticeRepositoryFactory; children: ReactNode }) {
  const { account } = useAuth()
  const repository = useMemo(() => account ? createRepository(account.id) : null, [account, createRepository])
  return <PracticeContext.Provider value={repository}>{children}</PracticeContext.Provider>
}
export function Application({ auth, createRepository, tutor = null }: { auth: AuthService | null; createRepository: PracticeRepositoryFactory; tutor?: TutorService | null }) {
  return <HashRouter><AuthProvider service={auth}><TutorContext.Provider value={tutor}><PracticeBoundary createRepository={createRepository}><AppRoutes /></PracticeBoundary></TutorContext.Provider></AuthProvider></HashRouter>
}
export default function App() {
  const config = getSupabase()
  const auth = useMemo(() => config.client ? createAuthService(config.client) : null, [config.client])
  const createRepository = useMemo<PracticeRepositoryFactory>(() => (userId) => {
    if (!config.client) throw new Error('Missing configuration')
    return new SupabasePracticeRepository(config.client, userId)
  }, [config.client])
  const tutor = useMemo(() => config.client ? new SupabaseTutorService(config.client) : null, [config.client])
  if (config.error) return <main className="error-page"><h1>LearnForge</h1><p role="alert">{config.error}</p></main>
  return <Application auth={auth} createRepository={createRepository} tutor={tutor} />
}
