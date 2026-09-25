import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

export type AppSupabase = SupabaseClient<Database>
export type SupabaseConfiguration = { client: AppSupabase; error: null } | { client: null; error: string }
export function configureSupabase(url: unknown, key: unknown): SupabaseConfiguration {
  try {
    if (typeof url !== 'string' || typeof key !== 'string' || !url || !key) throw new Error('Missing config')
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol) || !key.startsWith('sb_publishable_')) throw new Error('Invalid config')
    return { client: createClient<Database>(url, key, {
      global: { fetch: (input, init) => fetch(input, { ...init,
        signal: AbortSignal.any([AbortSignal.timeout(15000), ...(init?.signal ? [init.signal] : [])]),
      }) },
      auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
    } }), error: null }
  } catch {
    return { client: null, error: 'Supabase 設定錯誤：請設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY（publishable key）。' }
  }
}
let configuration: SupabaseConfiguration | undefined
export function getSupabase(): SupabaseConfiguration {
  return configuration ??= configureSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
}
