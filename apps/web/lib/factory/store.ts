import 'server-only'
import { after } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createSupabaseStore } from '@/lib/supabase/factory-store'
import { createMemoryStore } from './memory-store'
import { simulateQa } from './simulated-qa'
import type { FactoryStore } from './types'

export type { FactoryStore } from './types'

/**
 * Runtime services the Factory depends on. Tests swap these with
 * `setFactoryRuntime` (fresh memory store, no artificial pacing).
 */
export interface FactoryRuntime {
  store: FactoryStore
  /** Used to pace simulated steps so the live timeline is watchable. */
  sleep: (ms: number) => Promise<void>
  now: () => Date
  /** Run work after the response is sent (`after()` in Next; awaited directly in tests). */
  schedule: (task: () => Promise<void>) => void
  /** QA used when GitHub Actions is not connected. */
  simulateQa: typeof simulateQa
}

const g = globalThis as typeof globalThis & {
  __pfRuntime?: FactoryRuntime
  __pfMemoryStore?: FactoryStore
}

function defaultRuntime(): FactoryRuntime {
  const db = getSupabaseAdmin()
  // One memory store per server instance, shared across route modules and HMR reloads.
  const store = db ? createSupabaseStore(db) : (g.__pfMemoryStore ??= createMemoryStore())
  return {
    store,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => new Date(),
    schedule: (task) => after(task),
    simulateQa,
  }
}

export function getRuntime(): FactoryRuntime {
  return g.__pfRuntime ?? defaultRuntime()
}

export function getStore(): FactoryStore {
  return getRuntime().store
}

/** Override the runtime (tests). Pass null to restore the default. */
export function setFactoryRuntime(runtime: FactoryRuntime | null) {
  g.__pfRuntime = runtime ?? undefined
}
