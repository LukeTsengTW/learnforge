import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NotFoundPage } from './components/ErrorPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { HistoryPage } from './pages/HistoryPage'
import { MistakesPage } from './pages/MistakesPage'
import { ResultPage } from './pages/ResultPage'
import { AiUsagePage } from './pages/AiUsagePage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ReviewPage } from './pages/ReviewPage'
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
import { createAccountSecurity, SecurityContext, type AccountSecurity } from './features/auth/account-security'

const AuthorPage = lazy(() => import('./features/author/AuthorPage').then((module) => ({ default: module.AuthorPage })))
const AccountPage = lazy(() => import('./pages/AccountPage').then(module => ({ default: module.AccountPage })))
const RecoverAccountPage = lazy(() => import('./pages/RecoverAccountPage').then(module => ({ default: module.RecoverAccountPage })))
const RecoveryPage = lazy(() => import('./pages/RecoveryPage').then(module => ({ default: module.RecoveryPage })))
const securityPage = (page: ReactNode) => <Suspense fallback={<p role="status">正在載入…</p>}>{page}</Suspense>

export function AppRoutes() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="library" element={<LibraryPage />} />
    <Route path="author" element={<Suspense fallback={<p role="status">正在載入題庫編寫工具…</p>}><AuthorPage /></Suspense>} />
    <Route path="login" element={<AuthPage key="login" mode="login" />} />
    <Route path="register" element={<AuthPage key="register" mode="register" />} />
    <Route path="forgot-password" element={<AuthPage key="hint" mode="hint" />} />
    <Route path="recover-account" element={securityPage(<RecoverAccountPage />)} />
    <Route element={<RequireAuth />}>
      <Route path="account" element={securityPage(<AccountPage />)} />
      <Route path="recovery" element={securityPage(<RecoveryPage />)} />
      <Route path="quiz/:quizId" element={<PracticeQuizRoute />} />
      <Route path="result/:attemptId" element={<ResultPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="mistakes" element={<MistakesPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="review" element={<ReviewPage />} />
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
export function Application({ auth, createRepository, tutor = null, security = null }: { auth: AuthService | null; createRepository: PracticeRepositoryFactory; tutor?: TutorService | null; security?: AccountSecurity | null }) {
  return <HashRouter><AuthProvider service={auth}><SecurityContext.Provider value={security}><TutorContext.Provider value={tutor}><PracticeBoundary createRepository={createRepository}><AppRoutes /></PracticeBoundary></TutorContext.Provider></SecurityContext.Provider></AuthProvider></HashRouter>
}
export default function App() {
  const [needsBackend, setNeedsBackend] = useState(() => window.location.hash.split('?')[0] !== '#/author')
  useEffect(() => {
    const updateRoute = () => { if (window.location.hash.split('?')[0] !== '#/author') setNeedsBackend(true) }
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])
  // Direct author visits need no backend. Once initialized, retain the client across
  // routes: removing it while AuthProvider still holds an account breaks its repository.
  const config = needsBackend ? getSupabase() : null
  const client = config?.client ?? null
  const auth = useMemo(() => client ? createAuthService(client) : null, [client])
  const createRepository = useMemo<PracticeRepositoryFactory>(() => (userId) => {
    if (!client) throw new Error('Missing configuration')
    return new SupabasePracticeRepository(client, userId)
  }, [client])
  const tutor = useMemo(() => client ? new SupabaseTutorService(client) : null, [client])
  const security = useMemo(() => client ? createAccountSecurity(client) : null, [client])
  if (config?.error) return <main className="error-page"><h1>LearnForge</h1><p role="alert">{config.error}</p></main>
  return <Application auth={auth} createRepository={createRepository} tutor={tutor} security={security} />
}
