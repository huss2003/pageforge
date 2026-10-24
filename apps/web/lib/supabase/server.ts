import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getConfig } from '@/lib/factory/config'

/**
 * Server-side Supabase client using the secret key. Row level security is on
 * with no policies, so only this client can read or write the pf_* tables.
 * Returns null when Supabase is not configured.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const config = getConfig().supabase
  if (!config) return null
  const g = globalThis as typeof globalThis & {
    __pfSupabase?: { key: string; client: SupabaseClient }
  }
  const key = `${config.url}|${config.secretKey.slice(-6)}`
  if (g.__pfSupabase?.key !== key) {
    g.__pfSupabase = {
      key,
      client: createClient(config.url, config.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { 'x-application-name': 'pageforge-factory' } },
      }),
    }
  }
  return g.__pfSupabase.client
}
