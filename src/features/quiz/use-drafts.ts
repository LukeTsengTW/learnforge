import { useContext, useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { PracticeContext } from './practice-context'
import type { DraftReference } from './practice-repository'

export function useDrafts() {
  const { account } = useAuth()
  const repo = useContext(PracticeContext)
  const [state, setState] = useState<{ owner: string; drafts: DraftReference[] } | null>(null)
  useEffect(() => {
    if (!account || !repo) return
    let active = true
    void repo.listCurrentDrafts().then((drafts) => { if (active) setState({ owner: account.id, drafts }) })
      .catch(() => { if (active) setState({ owner: account.id, drafts: [] }) })
    return () => { active = false }
  }, [account, repo])
  return account && state?.owner === account.id ? state.drafts : []
}
