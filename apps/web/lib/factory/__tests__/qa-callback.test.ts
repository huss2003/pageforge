import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST as callback } from '@/app/api/factory/qa-callback/route'
import { setFactoryRuntime } from '../store'
import { brief, clearEnv, req, testRuntime } from './helpers'

const SECRET = 'qa-callback-secret-for-tests'

function post(body: unknown, secret: string | null = SECRET) {
  return callback(
    req('/api/factory/qa-callback', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: secret ? { 'x-qa-secret': secret } : {},
    }),
  )
}

const scores = (n: number) => ({ performance: n, accessibility: n, seo: n, bestPractices: n })

async function seedRun(store: ReturnType<typeof testRuntime>['runtime']['store']) {
  const run = await store.createRun({ mode: 'demo', brief, simulated: false, ipHash: null })
  await store.updateRun(run.id, {
    status: 'qa-running',
    slug: 'refinery-inspection-abc123',
    previewUrl: 'http://localhost:3000/preview/x?t=y',
    page: {
      kind: 'landing',
      title: 'Hoverline for a refinery',
      slug: 'refinery-inspection-abc123',
      seo: { title: 'Drone inspection for refinery teams', description: 'Short.', noindex: true },
      blocks: [
        {
          _key: 'hero-1',
          _type: 'hero',
          variant: 'route',
          heading: 'Find corrosion early',
          subheading:
            'A docked drone flies the same route over tank roofs and flare stacks every shift and files each finding.',
          primaryCta: { label: 'Book a demo', href: '#demo' },
          secondaryCta: { label: 'Learn more', href: '#how' },
          siteType: 'refinery',
        },
      ],
    },
  })
  return run.id
}

describe('POST /api/factory/qa-callback', () => {
  beforeEach(() => {
    clearEnv()
    process.env.QA_CALLBACK_SECRET = SECRET
  })
  afterEach(() => setFactoryRuntime(null))

  it('rejects a missing or wrong secret', async () => {
    testRuntime()
    expect((await post({}, null)).status).toBe(401)
    expect((await post({}, 'nope')).status).toBe(401)
  })

  it('is disabled without QA_CALLBACK_SECRET', async () => {
    testRuntime()
    delete process.env.QA_CALLBACK_SECRET
    expect((await post({})).status).toBe(503)
  })

  it('validates the payload', async () => {
    testRuntime()
    expect((await post({ runId: 'x' })).status).toBe(422)
  })

  it('stores a passing result once and marks the run ready; repeats are no-ops', async () => {
    const { runtime } = testRuntime()
    const runId = await seedRun(runtime.store)
    const body = {
      runId,
      attempt: 1,
      url: 'http://localhost:3000/preview/x?t=y',
      scores: scores(98),
      issues: [],
      passed: true,
      workflowRunUrl: 'https://github.com/huss2003/pageforge/actions/runs/1',
    }
    const first = await post(body)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ status: 'ready', passed: true })

    const dup = await post(body)
    expect(dup.status).toBe(200)
    expect(await dup.json()).toEqual({ status: 'duplicate' })

    const run = await runtime.store.getRun(runId)
    expect(run?.status).toBe('ready')
    expect(run?.qaAttempts).toBe(1)
    expect(await runtime.store.listQaResults(runId)).toHaveLength(1)
    expect((await runtime.store.listQaResults(runId))[0]!.simulated).toBe(false)
  })

  it('concurrent duplicate deliveries record one result and start one fix', async () => {
    const { runtime, drain } = testRuntime()
    const runId = await seedRun(runtime.store)
    const body = {
      runId,
      attempt: 1,
      url: 'http://localhost:3000/preview/x?t=y',
      scores: { ...scores(97), accessibility: 88 },
      issues: [
        { source: 'axe', id: 'link-name', message: 'Generic link text', blockKey: 'hero-1' },
      ],
      passed: false,
    }
    const responses = await Promise.all([post(body), post(body), post(body)])
    const outcomes = await Promise.all(responses.map((r) => r.json()))
    expect(outcomes.filter((o) => o.status === 'fixing')).toHaveLength(1)
    expect(outcomes.filter((o) => o.status === 'duplicate')).toHaveLength(2)
    expect(await runtime.store.listQaResults(runId)).toHaveLength(1)

    // The single fix runs, patches the hero link, then re-tests (simulated: no dispatcher).
    await drain()
    const run = await runtime.store.getRun(runId)
    expect(run?.fixes).toHaveLength(1)
    expect(run?.fixes[0]!.changes).toContainEqual(
      expect.objectContaining({
        blockKey: 'hero-1',
        field: 'secondaryCta.label',
        before: 'Learn more',
      }),
    )
    const fixSteps = (await runtime.store.listSteps(runId)).filter((s) => s.step === 'fix')
    expect(fixSteps).toHaveLength(1)
  })

  it('stops after the last attempt and records that QA did not pass', async () => {
    const { runtime } = testRuntime()
    const runId = await seedRun(runtime.store)
    await runtime.store.updateRun(runId, { qaAttempts: 1 })
    const res = await post({
      runId,
      attempt: 2,
      url: 'http://localhost:3000/preview/x?t=y',
      scores: { ...scores(97), seo: 80 },
      issues: [{ source: 'lighthouse', id: 'meta-description', message: 'Too short' }],
      passed: false,
    })
    expect(await res.json()).toEqual({ status: 'ready', passed: false })
    const run = await runtime.store.getRun(runId)
    expect(run?.status).toBe('ready')
    expect(run?.lastQa?.passed).toBe(false)
  })

  it('rejects an out-of-order attempt and unknown runs', async () => {
    const { runtime } = testRuntime()
    const runId = await seedRun(runtime.store)
    const base = { url: 'http://localhost:3000/p', scores: scores(99), issues: [], passed: true }
    expect((await post({ ...base, runId, attempt: 2 })).status).toBe(409)
    expect(
      (await post({ ...base, runId: '00000000-0000-4000-8000-000000000000', attempt: 1 })).status,
    ).toBe(404)
  })
})
