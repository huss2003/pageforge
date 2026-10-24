import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { secretEnv } from '@/lib/env'

/**
 * Server-side Supabase client using the secret key. Row level security is on
 * with no policies, so only this client can read or write the pf_* tables.
 * Returns null when Supabase is not configured.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const secretKey = secretEnv('SUPABASE_SECRET_KEY')
  if (!url || !secretKey) return null
  const g = globalThis as typeof globalThis & {
    __pfSupabase?: { key: string; client: SupabaseClient }
  }
  const key = `${url}|${secretKey.slice(-6)}`
  if (g.__pfSupabase?.key !== key) {
    g.__pfSupabase = {
      key,
      client: createClient(url, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { 'x-application-name': 'pageforge-abm' } },
      }),
    }
  }
  return g.__pfSupabase.client
}
