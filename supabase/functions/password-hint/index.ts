import { createClient } from 'npm:@supabase/supabase-js@2.117.1'
import type { Database } from '../../../src/types/database.types.ts'
import { createHintHandler } from './handler.ts'

// Provided by the Edge runtime only. Never expose this server credential to Vite.
const client = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
Deno.serve(createHintHandler({
  async lookup(username, ipHash) {
    const { data, error } = await client.rpc('request_password_hint', { p_username: username, p_ip_hash: ipHash })
    if (error) throw new Error('Hint unavailable')
    return data
  },
}))
