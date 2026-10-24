import { describe, expect, it, vi } from 'vitest'
import { postCallback } from '../src/callback'
import {
  computePassed,
  defaultThresholds,
  isQaCallbackPayload,
  isValidQaSecret,
  meetsThresholds,
  type QaCallbackPayload,
} from '../src/index'

const good = { performance: 92, accessibility: 100, seo: 100, bestPractices: 96 }

describe('thresholds', () => {
  it('passes at or above every threshold', () => {
    expect(meetsThresholds(good)).toBe(true)
    expect(meetsThresholds({ ...defaultThresholds })).toBe(true)
  })

  it('fails when any category is below its threshold', () => {
    for (const k of Object.keys(good) as (keyof typeof good)[]) {
      expect(meetsThresholds({ ...good, [k]: defaultThresholds[k] - 1 })).toBe(false)
    }
  })

  it('accepts custom thresholds', () => {
    expect(
      meetsThresholds({ ...good, performance: 70 }, { ...defaultThresholds, performance: 60 }),
    ).toBe(true)
  })

  it('requires no serious or critical axe violations to pass', () => {
    expect(computePassed(good, [])).toBe(true)
    expect(computePassed(good, ['minor', 'moderate', null])).toBe(true)
    expect(computePassed(good, ['moderate', 'serious'])).toBe(false)
    expect(computePassed(good, ['critical'])).toBe(false)
    expect(computePassed({ ...good, seo: 80 }, [])).toBe(false)
  })
})

const payload: QaCallbackPayload = {
  url: 'https://example.test/preview/x',
  scores: good,
  issues: [],
  passed: true,
  runId: 'run-1',
  attempt: 1,
  startedAt: '2026-10-24T00:00:00Z',
  durationMs: 1000,
}

describe('callback', () => {
  it('validates payloads and secrets', () => {
    expect(isQaCallbackPayload(payload)).toBe(true)
    expect(isQaCallbackPayload({ ...payload, scores: { performance: 1 } })).toBe(false)
    expect(isValidQaSecret('s3cret', 's3cret')).toBe(true)
    expect(isValidQaSecret('s3cret', 's3cre')).toBe(false)
    expect(isValidQaSecret(null, 's')).toBe(false)
    expect(isValidQaSecret('s', undefined)).toBe(false)
  })

  it('retries 5xx with backoff and sends the secret header', async () => {
    const statuses = [503, 502, 200]
    const fetch = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(null, { status: statuses.shift()! }),
    )
    const sleeps: number[] = []
    const r = await postCallback('https://app.test/api/qa', payload, {
      secret: 'abc',
      fetch,
      sleep: async (ms) => void sleeps.push(ms),
    })
    expect(r).toEqual({ ok: true, status: 200, attempts: 3 })
    expect(sleeps).toEqual([2000, 4000])
    const init = fetch.mock.calls[0]![1]!
    expect((init.headers as Record<string, string>)['x-qa-secret']).toBe('abc')
    expect(JSON.parse(String(init.body)).runId).toBe('run-1')
  })

  it('does not retry a 401', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 401 }))
    const r = await postCallback('https://app.test/api/qa', payload, {
      secret: 'x',
      fetch,
      sleep: async () => {},
    })
    expect(r).toEqual({ ok: false, status: 401, attempts: 1 })
  })

  it('gives up after 3 network failures', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const r = await postCallback('https://app.test/api/qa', payload, {
      secret: 'x',
      fetch,
      sleep: async () => {},
    })
    expect(r).toEqual({ ok: false, status: undefined, attempts: 3 })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
