import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../memory-store'
import { brief } from './helpers'

describe('memory store rate limiting', () => {
  it('allows up to the limit per key per UTC day', async () => {
    const store = createMemoryStore(() => new Date('2026-10-24T23:59:00Z'))
    const results = []
    for (let i = 0; i < 6; i++) results.push(await store.hitRateLimit('run:ip-a', 5))
    expect(results).toEqual([true, true, true, true, true, false])
    expect(await store.peekRateLimit('run:ip-a')).toBe(6)
    // Keys are independent.
    expect(await store.hitRateLimit('run:ip-b', 5)).toBe(true)
  })

  it('resets on the next UTC day', async () => {
    let now = new Date('2026-10-24T23:59:00Z')
    const store = createMemoryStore(() => now)
    for (let i = 0; i < 5; i++) await store.hitRateLimit('run:global', 5)
    expect(await store.hitRateLimit('run:global', 5)).toBe(false)
    now = new Date('2026-10-25T00:00:01Z')
    expect(await store.peekRateLimit('run:global')).toBe(0)
    expect(await store.hitRateLimit('run:global', 5)).toBe(true)
  })
})

describe('memory store runs', () => {
  it('claimRun is a compare-and-set', async () => {
    const store = createMemoryStore()
    const run = await store.createRun({ mode: 'demo', brief, simulated: true, ipHash: 'h' })
    await store.updateRun(run.id, { status: 'qa-running' })
    const first = await store.claimRun(
      run.id,
      { status: 'qa-running', qaAttempts: 0 },
      { status: 'fixing', qaAttempts: 1 },
    )
    const second = await store.claimRun(
      run.id,
      { status: 'qa-running', qaAttempts: 0 },
      { status: 'ready', qaAttempts: 1 },
    )
    expect(first?.status).toBe('fixing')
    expect(second).toBeNull()
  })

  it('stores QA results once per attempt and returns copies', async () => {
    const store = createMemoryStore()
    const run = await store.createRun({ mode: 'demo', brief, simulated: true, ipHash: null })
    const qa = {
      attempt: 1,
      createdAt: new Date().toISOString(),
      url: 'http://x',
      scores: { performance: 99, accessibility: 99, seo: 99, bestPractices: 99 },
      issues: [],
      passed: true,
      simulated: true,
    }
    expect(await store.addQaResult(run.id, qa)).toBe(true)
    expect(await store.addQaResult(run.id, qa)).toBe(false)
    const list = await store.listQaResults(run.id)
    list[0]!.passed = false
    expect((await store.listQaResults(run.id))[0]!.passed).toBe(true)
  })
})
