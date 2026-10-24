import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST as createRun, GET as listRuns } from '@/app/api/factory/runs/route'
import { GET as getRun } from '@/app/api/factory/runs/[id]/route'
import { POST as publish } from '@/app/api/factory/runs/[id]/publish/route'
import { GET as getStats } from '@/app/api/factory/stats/route'
import { setFactoryRuntime } from '../store'
import type { RunPayload } from '../types'
import { brief, clearEnv, req, testRuntime } from './helpers'

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe('simulated run lifecycle through the route handlers', () => {
  beforeEach(() => {
    clearEnv()
    process.env.PREVIEW_SECRET = 'preview-secret-for-tests'
  })
  afterEach(() => setFactoryRuntime(null))

  it('create → steps → simulated QA → fix → ready → publish', async () => {
    const { drain, advance } = testRuntime()

    // The simulated writer leaves 0-2 defects, seeded by brief + clock. With this brief
    // and the fixed test clock it leaves some, so QA attempt 1 fails and the fixer runs.
    const res = await createRun(
      req('/api/factory/runs', {
        method: 'POST',
        body: JSON.stringify({ ...brief, notes: 'fix-path' }),
      }),
    )
    expect(res.status).toBe(201)
    const { runId, mode } = (await res.json()) as { runId: string; mode: string }
    expect(mode).toBe('demo')

    // Before the background work runs the run is queued.
    const queued = (await (
      await getRun(req(`/api/factory/runs/${runId}`), params(runId))
    ).json()) as RunPayload
    expect(queued.run.status).toBe('queued')
    expect(queued.run).not.toHaveProperty('ipHash')

    await drain()
    advance(5_000)

    const r = await getRun(req(`/api/factory/runs/${runId}`), params(runId))
    expect(r.headers.get('cache-control')).toBe('no-store')
    const done = (await r.json()) as RunPayload
    expect(done.run.status).toBe('ready')
    expect(done.run.simulated).toBe(true)
    expect(done.run.plan?.sections[0]?.kind).toBe('hero')
    expect(done.run.previewUrl).toMatch(new RegExp(`/preview/${runId}\\?t=`))
    expect(done.run.slug).toMatch(/-[0-9a-f]{6}$/)

    const stepNames = done.steps.map((s) => s.step)
    expect(stepNames.slice(0, 4)).toEqual(['plan', 'write', 'validate', 'draft'])
    expect(stepNames).toContain('qa')

    // QA attempt 1 failed with issues, the fixer changed text, attempt 2 passed.
    expect(done.qa.length).toBe(2)
    expect(done.qa[0]!.passed).toBe(false)
    expect(done.qa[0]!.issues.length).toBeGreaterThan(0)
    expect(done.qa[0]!.simulated).toBe(true)
    expect(done.qa[1]!.passed).toBe(true)
    expect(stepNames).toContain('fix')
    expect(done.run.fixes).toHaveLength(1)
    expect(done.run.fixes[0]!.changes.length).toBeGreaterThan(0)
    for (const c of done.run.fixes[0]!.changes) expect(c.before).not.toBe(c.after)
    expect(done.run.readyAt).not.toBeNull()

    // Publish.
    const p = await publish(
      req(`/api/factory/runs/${runId}/publish`, { method: 'POST' }),
      params(runId),
    )
    expect(p.status).toBe(200)
    const pub = (await p.json()) as {
      liveUrl: string
      timeToShipMs: number
      run: RunPayload['run']
    }
    expect(pub.liveUrl).toBe(`/factory/p/${done.run.slug}`)
    expect(pub.run.status).toBe('published')
    expect(pub.timeToShipMs).toBe(Date.parse(pub.run.publishedAt!) - Date.parse(pub.run.createdAt))
    expect(pub.timeToShipMs).toBeGreaterThan(0)

    // Publishing twice is a no-op that returns the same URL.
    const again = await publish(
      req(`/api/factory/runs/${runId}/publish`, { method: 'POST' }),
      params(runId),
    )
    expect(again.status).toBe(200)
    const final = (await (
      await getRun(req(`/api/factory/runs/${runId}`), params(runId))
    ).json()) as RunPayload
    expect(final.steps.filter((s) => s.step === 'publish')).toHaveLength(1)
    expect(final.liveUrl).toBe(pub.liveUrl)

    // History and stats see it.
    const list = (await (await listRuns()).json()) as { runs: { id: string; fixes: number }[] }
    expect(list.runs[0]).toMatchObject({ id: runId, fixes: 1 })
    const stats = await (await getStats()).json()
    expect(stats).toMatchObject({
      published: 1,
      medianTimeToShipMs: pub.timeToShipMs,
      firstTryPassRate: 0,
      avgFixesPerRun: 1,
      today: { runs: 1, cap: 60 },
    })
    expect(stats.modelMix).toEqual([{ model: 'simulated', runs: 1 }])
  })

  it('refuses to publish before the run is ready', async () => {
    testRuntime()
    const res = await createRun(
      req('/api/factory/runs', { method: 'POST', body: JSON.stringify(brief) }),
    )
    const { runId } = (await res.json()) as { runId: string }
    const p = await publish(
      req(`/api/factory/runs/${runId}/publish`, { method: 'POST' }),
      params(runId),
    )
    expect(p.status).toBe(409)
    expect((await p.json()).error).toMatch(/queued/)
  })

  it('validates the brief and returns field errors', async () => {
    testRuntime()
    const res = await createRun(
      req('/api/factory/runs', {
        method: 'POST',
        body: JSON.stringify({ ...brief, audience: [] }),
      }),
    )
    expect(res.status).toBe(422)
    expect((await res.json()).fieldErrors.audience).toBeTruthy()
    const bad = await createRun(req('/api/factory/runs', { method: 'POST', body: '{' }))
    expect(bad.status).toBe(400)
  })

  it('rate-limits per IP (5/day) and globally (60/day)', async () => {
    testRuntime()
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await createRun(
        req('/api/factory/runs', {
          method: 'POST',
          body: JSON.stringify(brief),
          ip: '198.51.100.1',
        }),
      )
      statuses.push(res.status)
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429])

    // Global cap: 5 used above (the 6th was stopped before the global counter).
    let last = 0
    for (let i = 0; i < 60; i++) {
      const res = await createRun(
        req('/api/factory/runs', {
          method: 'POST',
          body: JSON.stringify(brief),
          ip: `198.51.100.${10 + Math.floor(i / 5)}`,
        }),
      )
      last = res.status
      if (res.status === 429) {
        expect((await res.json()).error).toMatch(/across all visitors/)
        expect(i).toBe(55)
        break
      }
    }
    expect(last).toBe(429)
  })

  it('demands a Turnstile token when the secret is set', async () => {
    testRuntime()
    process.env.TURNSTILE_SECRET_KEY = 'secret'
    const res = await createRun(
      req('/api/factory/runs', { method: 'POST', body: JSON.stringify(brief) }),
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown and malformed run ids', async () => {
    testRuntime()
    const unknown = '00000000-0000-4000-8000-000000000000'
    expect((await getRun(req(`/api/factory/runs/${unknown}`), params(unknown))).status).toBe(404)
    expect((await getRun(req('/api/factory/runs/nope'), params('nope'))).status).toBe(404)
  })
})
