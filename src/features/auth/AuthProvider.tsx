import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AuthContext } from './auth-context'
import { authError, type Account, type AuthService } from './auth-service'
export function AuthProvider({ service, children }: { service: AuthService | null; children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef({ value: 0 })
  const refresh = useCallback(async () => {
    const current = ++generation.current.value
    try {
      const restored = await service?.restore() ?? null
      if (current === generation.current.value) { setAccount(restored); setError(null) }
    } catch (failure) {
      if (current === generation.current.value) { setAccount(null); setError(authError(failure)) }
    } finally { if (current === generation.current.value) setLoading(false) }
  }, [service])
  useEffect(() => {
    const unsubscribe = service?.subscribe(() => { void refresh() })
    const requests = generation.current
    let active = true
    queueMicrotask(() => { if (active) void refresh() })
    return () => { active = false; ++requests.value; unsubscribe?.() }
  }, [service, refresh])
  return <AuthContext.Provider value={{ account, loading, error, service, refresh }}>{children}</AuthContext.Provider>
}
