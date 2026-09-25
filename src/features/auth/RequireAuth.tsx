import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
export function RequireAuth() {
  const { account, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p role="status">正在恢復登入狀態…</p>
  return account ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname }} replace />
}
