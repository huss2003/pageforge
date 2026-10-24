import { describe, expect, it, vi } from 'vitest'
import {
  EVENTS_ENDPOINT,
  captureUtm,
  createTracker,
  getVisitorId,
  newScrollMilestones,
  readConsent,
  scrollPercent,
  writeConsent,
  type StorageLike,
} from '@/lib/abm/tracking'
import type { TrackEvent } from '@/lib/abm/types'

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

const ctx = {
  campaignId: 'cmp_1',
  versionId: 'ver_1',
  pageKind: 'account' as const,
  path: '/demo/northstar',
}

describe('scroll milestones', () => {
  it('fires each milestone once, in order', () => {
    const sent = new Set<number>()
    expect(newScrollMilestones(10, sent)).toEqual([])
    expect(newScrollMilestones(55, sent)).toEqual([25, 50])
    expect(newScrollMilestones(60, sent)).toEqual([])
    expect(newScrollMilestones(30, sent)).toEqual([])
    expect(newScrollMilestones(100, sent)).toEqual([75, 100])
    expect(newScrollMilestones(100, sent)).toEqual([])
  })

  it('computes depth from the bottom of the viewport', () => {
    expect(scrollPercent(0, 800, 4000)).toBe(20)
    expect(scrollPercent(3200, 800, 4000)).toBe(100)
    expect(scrollPercent(0, 900, 600)).toBe(100)
  })

  it('sends one scroll_depth event per milestone through the tracker', () => {
    const send = vi.fn()
    const t = createTracker(ctx, { storage: memoryStorage(), send, search: '' })
    t.scroll(52)
    t.scroll(52)
    t.scroll(80)
    const depths = send.mock.calls.map(([, body]) => (JSON.parse(body) as TrackEvent).props?.depth)
    expect(depths).toEqual([25, 50, 75])
  })
})

describe('UTM capture', () => {
  it('reads utm_* parameters and ignores the rest', () => {
    expect(
      captureUtm(
        '?utm_source=email&utm_medium=email&utm_campaign=abm-northstar&utm_content=abm-page&ref=x',
      ),
    ).toEqual({ source: 'email', medium: 'email', campaign: 'abm-northstar', content: 'abm-page' })
  })

  it('trims, drops empty values and caps length', () => {
    const utm = captureUtm(`?utm_source=%20linkedin%20&utm_term=&utm_campaign=${'a'.repeat(300)}`)
    expect(utm.source).toBe('linkedin')
    expect(utm.term).toBeUndefined()
    expect(utm.campaign).toHaveLength(120)
  })
})

describe('visitor id', () => {
  it('is created once and reused', () => {
    const s = memoryStorage()
    const a = getVisitorId(s, () => 'abc123def456')
    const b = getVisitorId(s, () => 'zzzzzzzzzzzz')
    expect(a).toBe('abc123def456')
    expect(b).toBe(a)
  })

  it('still works when storage throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(getVisitorId(broken, () => 'fallback-id-1')).toBe('fallback-id-1')
    expect(getVisitorId(null, () => 'no-storage-1')).toBe('no-storage-1')
  })
})

describe('beacon payload', () => {
  it('posts a TrackEvent to /api/abm/events', () => {
    const send = vi.fn()
    const t = createTracker(ctx, {
      storage: memoryStorage(),
      send,
      search: '?utm_source=email&utm_campaign=abm-northstar',
      randomId: () => 'visitor0001',
    })
    t.track('page_view')
    t.track('cta_click', { label: 'Book a walkthrough' })
    expect(send).toHaveBeenCalledTimes(2)
    const [url, body] = send.mock.calls[1]!
    expect(url).toBe(EVENTS_ENDPOINT)
    expect(JSON.parse(body)).toEqual({
      campaignId: 'cmp_1',
      versionId: 'ver_1',
      pageKind: 'account',
      path: '/demo/northstar',
      visitorId: 'visitor0001',
      type: 'cta_click',
      props: { label: 'Book a walkthrough' },
      utm: { source: 'email', campaign: 'abm-northstar' },
    })
    // No props and no UTM: the keys are left out, not sent empty.
    const bare = createTracker(ctx, { storage: memoryStorage(), send, search: '' })
    bare.track('page_view')
    expect(Object.keys(JSON.parse(send.mock.calls[2]![1]))).not.toContain('utm')
  })

  it('records form_start once per form and mirrors the same properties', () => {
    const send = vi.fn()
    const mirror = vi.fn()
    const t = createTracker(ctx, {
      storage: memoryStorage(),
      send,
      search: '?utm_source=linkedin',
      randomId: () => 'visitor0002',
    })
    t.setMirror(mirror)
    expect(t.formStart('lead')).toBe(true)
    expect(t.formStart('lead')).toBe(false)
    expect(send).toHaveBeenCalledTimes(1)
    expect(mirror).toHaveBeenCalledWith('form_start', {
      campaignId: 'cmp_1',
      versionId: 'ver_1',
      pageKind: 'account',
      path: '/demo/northstar',
      visitorId: 'visitor0002',
      form: 'lead',
      utm_source: 'linkedin',
    })
  })

  it('keeps sending first-party events when the mirror throws', () => {
    const send = vi.fn()
    const t = createTracker(ctx, { storage: memoryStorage(), send, search: '' })
    t.setMirror(() => {
      throw new Error('blocked by an extension')
    })
    expect(() => t.track('page_view')).not.toThrow()
    expect(send).toHaveBeenCalledOnce()
  })
})

describe('consent', () => {
  it('remembers the choice and tolerates broken storage', () => {
    const s = memoryStorage()
    expect(readConsent(s)).toBeNull()
    writeConsent('declined', s)
    expect(readConsent(s)).toBe('declined')
    expect(readConsent(null)).toBeNull()
  })
})
