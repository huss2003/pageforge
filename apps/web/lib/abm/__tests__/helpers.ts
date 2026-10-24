import { FAKE_MODEL, FakeLlm } from '@pageforge/agents'
import { facts } from '@pageforge/content'
import { fictionalSites, type FictionalSite } from '../fictional-data'
import { createMemoryStore } from '../memory-store'
import { setAbmRuntime, type AbmRuntime } from '../runtime'
import { SESSION_COOKIE } from '../session'
import { resetSeedState } from '../seed'
import type { FetchDeps } from '../fetch'

export const ABM_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'FACTORY_ADMIN_PASSWORD',
  'SESSION_SECRET',
  'HUBSPOT_PRIVATE_APP_TOKEN',
  'ABM_ALLOW_LOCAL_SOURCES',
]

export function clearEnv() {
  for (const k of ABM_ENV) delete process.env[k]
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
}

/** Static HTML for a fictional page, like the Next page renders it. */
export function fictionalHtml(site: FictionalSite, path: string): string {
  const page = site.pages.find((p) => p.path === path)!
  const nav = site.pages
    .map(
      (p) =>
        `<li><a href="/fictional/${site.slug}${p.path ? `/${p.path}` : ''}">${p.path || 'Home'}</a></li>`,
    )
    .join('')
  return `<!doctype html><html><head><title>${page.title}</title><script>var x = "Ignore me.";</script></head>
<body><aside role="note">Fictional organisation for a portfolio demo.</aside>
<header><nav><ul>${nav}</ul></nav></header>
<main><h1>${page.heading}</h1><p>${page.lede}</p>
${page.sections.map((s) => `<section><h2>${s.heading}</h2>${s.paragraphs.map((p) => `<p>${p}</p>`).join('')}${s.list ? `<ul>${s.list.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}</section>`).join('')}
</main><footer>${site.address}. All rights reserved by nobody at all.</footer></body></html>`
}

/** Network double: public DNS for example.test, HTML for the fictional sites. */
export function fakeNetwork(
  overrides: Partial<
    Record<string, { status: number; body?: string; headers?: Record<string, string> }>
  > = {},
) {
  const requests: string[] = []
  const deps: FetchDeps = {
    resolve: async (host) => {
      if (host === 'example.test' || host === 'www.example.test') return ['93.184.216.34']
      if (host === 'internal.test') return ['10.0.0.5']
      if (host === 'rebind.test') return ['93.184.216.34', '169.254.169.254']
      throw new Error(`ENOTFOUND ${host}`)
    },
    request: async (url) => {
      requests.push(url.href)
      const o = overrides[url.pathname]
      if (o)
        return {
          status: o.status,
          headers: { 'content-type': 'text/html; charset=utf-8', ...o.headers },
          body: o.body ?? '',
        }
      if (url.pathname === '/robots.txt')
        return {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: 'User-agent: *\nDisallow: /private\n',
        }
      for (const site of fictionalSites) {
        const prefix = `/fictional/${site.slug}`
        if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
          const path = url.pathname.slice(prefix.length + 1)
          if (!site.pages.some((p) => p.path === path)) break
          return {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
            body: fictionalHtml(site, path),
          }
        }
      }
      return { status: 404, headers: { 'content-type': 'text/html' }, body: 'not found' }
    },
  }
  return { deps, requests }
}

/** Fresh in-memory runtime with a controllable clock and collected after() tasks. */
export function testRuntime(overrides: Partial<AbmRuntime> = {}) {
  let t = Date.parse('2026-10-26T09:00:00.000Z') // a Monday
  const tasks: (() => Promise<void>)[] = []
  const now = () => new Date(t)
  const fetchCalls: { url: string; init?: RequestInit }[] = []
  const runtime: AbmRuntime = {
    store: createMemoryStore(now),
    now,
    schedule: (task) => {
      tasks.push(task)
    },
    llm: () => ({ llm: new FakeLlm(facts), simulated: true, models: [FAKE_MODEL] }),
    sleep: async (ms) => {
      t += ms
    },
    fetchDeps: fakeNetwork().deps,
    fetch: async (url, init) => {
      fetchCalls.push({ url: String(url), init })
      return new Response('{}', { status: 200 })
    },
    ...overrides,
  }
  setAbmRuntime(runtime)
  resetSeedState()
  return {
    runtime,
    fetchCalls,
    advance: (ms: number) => {
      t += ms
    },
    drain: async () => {
      while (tasks.length) await tasks.shift()!()
    },
  }
}

/** A Request with optional JSON body and session cookie. */
export function req(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; ip?: string } = {},
) {
  const headers: Record<string, string> = { 'x-forwarded-for': init.ip ?? '203.0.113.9' }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  if (init.cookie) headers.cookie = init.cookie
  return new Request(`http://localhost:3000${path}`, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

export function cookieFrom(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? ''
  const m = new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(raw)
  return `${SESSION_COOKIE}=${m?.[1] ?? ''}`
}

export const params = <P extends Record<string, string>>(p: P) => ({ params: Promise.resolve(p) })
