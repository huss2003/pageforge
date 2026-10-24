import { createMemoryStore } from '../memory-store'
import { simulateQa } from '../simulated-qa'
import { setFactoryRuntime, type FactoryRuntime } from '../store'

export const FACTORY_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'FACTORY_ADMIN_PASSWORD',
  'SESSION_SECRET',
  'PREVIEW_SECRET',
  'QA_CALLBACK_SECRET',
  'GITHUB_QA_DISPATCH_TOKEN',
  'NEXT_PUBLIC_SANITY_PROJECT_ID',
  'SANITY_API_WRITE_TOKEN',
]

export function clearEnv() {
  for (const k of FACTORY_ENV) delete process.env[k]
}

/** Fresh in-memory runtime with a controllable clock and collected `after()` tasks. */
export function testRuntime(overrides: Partial<FactoryRuntime> = {}) {
  let t = Date.parse('2026-10-24T10:00:00.000Z')
  const tasks: (() => Promise<void>)[] = []
  const now = () => new Date(t)
  const runtime: FactoryRuntime = {
    store: createMemoryStore(now),
    now,
    // Simulated pacing advances the fake clock instead of waiting.
    sleep: async (ms) => {
      t += ms
    },
    // Like after(): nothing runs until the response is done (here: until drain()).
    schedule: (task) => {
      tasks.push(task)
    },
    simulateQa,
    ...overrides,
  }
  setFactoryRuntime(runtime)
  return {
    runtime,
    advance: (ms: number) => {
      t += ms
    },
    /** Await every scheduled task, including ones scheduled while draining. */
    drain: async () => {
      while (tasks.length) await tasks.shift()!()
    },
  }
}

export const brief = {
  prospect: 'Gulf Coast refinery running rope-access tank inspections',
  siteType: 'refinery' as const,
  audience: ['Reliability engineer', 'HSE lead'],
  goal: 'book-demo' as const,
  notes: 'Turnaround slipped 9 days after late corrosion findings.',
}

export function req(url: string, init: RequestInit & { ip?: string } = {}) {
  const headers = new Headers(init.headers)
  headers.set('x-forwarded-for', init.ip ?? '203.0.113.7')
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  return new Request(`http://localhost:3000${url}`, { ...init, headers })
}
