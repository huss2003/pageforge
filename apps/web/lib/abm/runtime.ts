import 'server-only'
import { after } from 'next/server'
import { createLlmFromEnv, type EnvLlm } from '@pageforge/agents'
import { facts } from '@pageforge/content'
import { secretEnv } from '@/lib/env'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createMemoryStore } from './memory-store'
import { createSupabaseStore } from './supabase-store'
import type { AbmStore } from './store'
import type { FetchDeps } from './fetch'

/**
 * Services the ABM backend depends on. Tests swap them with
 * `setAbmRuntime` (fresh memory store, fixed clock, mocked network).
 */
export interface AbmRuntime {
  store: AbmStore
  now: () => Date
  /** Run work after the response is sent (`after()` in Next; collected in tests). */
  schedule: (task: () => Promise<void>) => void
  /** Model client: Gemini → Groq, or the offline FakeLlm without keys. */
  llm: () => EnvLlm
  /** Delay for simulated drafts so the UI can show "generating". */
  sleep: (ms: number) => Promise<void>
  /** Network for the source fetcher (DNS + HTTP); default is the real network. */
  fetchDeps?: Partial<FetchDeps>
  /** fetch used for HubSpot and Turnstile. */
  fetch: typeof fetch
}

const g = globalThis as typeof globalThis & {
  __pfAbmRuntime?: AbmRuntime
  __pfAbmMemory?: AbmStore
}

function defaultRuntime(): AbmRuntime {
  const db = getSupabaseAdmin()
  const store = db ? createSupabaseStore(db) : (g.__pfAbmMemory ??= createMemoryStore())
  return {
    store,
    now: () => new Date(),
    schedule: (task) => after(task),
    llm: () =>
      createLlmFromEnv(
        {
          GEMINI_API_KEY: secretEnv('GEMINI_API_KEY') ?? undefined,
          GEMINI_MODEL: process.env.GEMINI_MODEL,
          GROQ_API_KEY: secretEnv('GROQ_API_KEY') ?? undefined,
          GROQ_MODEL: process.env.GROQ_MODEL,
        },
        { facts, timeoutMs: 75_000 },
      ),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    fetch: (input, init) => fetch(input, init),
  }
}

export function getAbmRuntime(): AbmRuntime {
  return g.__pfAbmRuntime ?? defaultRuntime()
}

/** Override the runtime (tests). Pass null to restore the default. */
export function setAbmRuntime(runtime: AbmRuntime | null): void {
  g.__pfAbmRuntime = runtime ?? undefined
}
