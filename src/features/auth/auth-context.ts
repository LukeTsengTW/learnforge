import { createContext, useContext } from 'react'
import type { Account, AuthService } from './auth-service'
export interface AuthState { account: Account | null; loading: boolean; error: string | null; service: AuthService | null; refresh: () => Promise<void> }
export const AuthContext = createContext<AuthState | null>(null)
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider required')
  return value
}
