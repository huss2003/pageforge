import type { EventType, TrackEvent } from './types'

/**
 * First-party engagement tracking for account pages (client only).
 *
 * - Anonymous visitor id in localStorage; no cookies. Storage can be missing
 *   or throw (private windows, blocked site data), so every access is
 *   guarded and the id falls back to one kept in memory for this page view.
 * - UTM parameters are read from the landing URL.
 * - Events go to POST /api/abm/events with navigator.sendBeacon (fetch with
 *   keepalive when beacons are unavailable).
 * - When the visitor accepts analytics, a mirror (PostHog) receives the same
 *   events with the same properties.
 */

export const EVENTS_ENDPOINT = '/api/abm/events'
const VISITOR_KEY = 'pf_vid'
export const SCROLL_MILESTONES = [25, 50, 75, 100] as const
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const

export type Utm = NonNullable<TrackEvent['utm']>
type Props = NonNullable<TrackEvent['props']>

export interface TrackingContext {
  campaignId: string | null
  versionId: string | null
  pageKind: TrackEvent['pageKind']
  path: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface TrackerDeps {
  storage?: StorageLike | null
  /** Defaults to navigator.sendBeacon, then fetch keepalive. */
  send?: (url: string, body: string) => void
  /** Search string of the landing URL, e.g. "?utm_source=email". */
  search?: string
  /** Random id source; injectable for tests. */
  randomId?: () => string
}

export type Mirror = (type: EventType, properties: Record<string, unknown>) => void

function safeStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function defaultRandomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID().replace(/-/g, '')
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

/** The visitor id kept in storage, created on first visit. Never longer than 64. */
export function getVisitorId(
  storage: StorageLike | null | undefined,
  randomId: () => string = defaultRandomId,
): string {
  try {
    const existing = storage?.getItem(VISITOR_KEY)
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing
  } catch {
    // Storage blocked: fall through to a fresh id for this page view.
  }
  const id =
    randomId()
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 64) || 'anon'
  try {
    storage?.setItem(VISITOR_KEY, id)
  } catch {
    // Not persisted; the next visit gets a new id.
  }
  return id
}

/** utm_* parameters from a query string; values trimmed and capped at 120 chars. */
export function captureUtm(search: string): Utm {
  const out: Utm = {}
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return out
  }
  for (const key of UTM_KEYS) {
    const v = params.get(`utm_${key}`)?.trim()
    if (v) out[key] = v.slice(0, 120)
  }
  return out
}

/**
 * Milestones newly reached at this scroll position. Each fires once:
 * `sent` is updated in place.
 */
export function newScrollMilestones(percent: number, sent: Set<number>): number[] {
  const reached: number[] = []
  for (const m of SCROLL_MILESTONES) {
    if (percent >= m && !sent.has(m)) {
      sent.add(m)
      reached.push(m)
    }
  }
  return reached
}

/** Scroll depth of the document as 0–100. A page shorter than the viewport counts as 100. */
export function scrollPercent(scrollY: number, viewport: number, docHeight: number): number {
  const max = docHeight - viewport
  if (max <= 0) return 100
  return Math.max(0, Math.min(100, Math.round(((scrollY + viewport) / docHeight) * 100)))
}

export function buildEvent(
  ctx: TrackingContext,
  visitorId: string,
  utm: Utm,
  type: EventType,
  props?: Props,
): TrackEvent {
  const event: TrackEvent = {
    campaignId: ctx.campaignId,
    versionId: ctx.versionId,
    pageKind: ctx.pageKind,
    path: ctx.path,
    visitorId,
    type,
  }
  if (props && Object.keys(props).length) event.props = props
  if (Object.keys(utm).length) event.utm = utm
  return event
}

/** Flat property bag for analytics tools: the same fields, utm_* expanded. */
export function mirrorProperties(event: TrackEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {
    campaignId: event.campaignId,
    versionId: event.versionId,
    pageKind: event.pageKind,
    path: event.path,
    visitorId: event.visitorId,
    ...(event.props ?? {}),
  }
  for (const [k, v] of Object.entries(event.utm ?? {})) out[`utm_${k}`] = v
  return out
}

function defaultSend(url: string, body: string): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      if (ok) return
    }
  } catch {
    // fall back to fetch
  }
  try {
    void fetch(url, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined)
  } catch {
    // Tracking never breaks the page.
  }
}

export interface Tracker {
  readonly visitorId: string
  readonly utm: Utm
  readonly context: TrackingContext
  track(type: EventType, props?: Props): TrackEvent
  /** Report a scroll position (0–100); sends any milestone reached for the first time. */
  scroll(percent: number): number[]
  /** form_start once per form id. */
  formStart(formId: string): boolean
  setMirror(mirror: Mirror | null): void
}

export function createTracker(ctx: TrackingContext, deps: TrackerDeps = {}): Tracker {
  const storage = deps.storage === undefined ? safeStorage() : deps.storage
  const send = deps.send ?? defaultSend
  const search = deps.search ?? (typeof window !== 'undefined' ? window.location.search : '')
  const visitorId = getVisitorId(storage, deps.randomId)
  const utm = captureUtm(search)
  const sentScroll = new Set<number>()
  const startedForms = new Set<string>()
  let mirror: Mirror | null = null

  const tracker: Tracker = {
    visitorId,
    utm,
    context: ctx,
    track(type, props) {
      const event = buildEvent(ctx, visitorId, utm, type, props)
      send(EVENTS_ENDPOINT, JSON.stringify(event))
      try {
        mirror?.(type, mirrorProperties(event))
      } catch {
        // A failing analytics script never breaks first-party tracking.
      }
      return event
    },
    scroll(percent) {
      const reached = newScrollMilestones(percent, sentScroll)
      for (const depth of reached) tracker.track('scroll_depth', { depth })
      return reached
    },
    formStart(formId) {
      if (startedForms.has(formId)) return false
      startedForms.add(formId)
      tracker.track('form_start', { form: formId })
      return true
    },
    setMirror(m) {
      mirror = m
    },
  }
  return tracker
}

// One tracker per page view, shared by the tracking script, the form and the calendar.
let active: Tracker | null = null

export function setActiveTracker(t: Tracker | null): void {
  active = t
}

export function getActiveTracker(): Tracker | null {
  return active
}

export const CONSENT_KEY = 'pf_analytics_consent'
export type Consent = 'accepted' | 'declined'

export function readConsent(storage: StorageLike | null = safeStorage()): Consent | null {
  try {
    const v = storage?.getItem(CONSENT_KEY)
    return v === 'accepted' || v === 'declined' ? v : null
  } catch {
    return null
  }
}

export function writeConsent(value: Consent, storage: StorageLike | null = safeStorage()): void {
  try {
    storage?.setItem(CONSENT_KEY, value)
  } catch {
    // Not remembered; the banner asks again next visit.
  }
}
