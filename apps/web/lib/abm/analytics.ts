import type { StoredEvent } from './store'
import type { Campaign, Claim, ConversionComparison, EngagementSummary, Meeting } from './types'

/** First-party analytics: engagement per campaign, account vs generic conversion, review metrics. */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
export const MIN_SAMPLE = 100

const depth = (e: StoredEvent) => {
  const v = e.props?.depth ?? e.props?.percent
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
}

/** "Hot": ≥ 2 visits by one visitor, or ≥ 75% scroll, or a CTA click, in the last 7 days. */
export function isHot(events: StoredEvent[], now: Date): boolean {
  const since = now.getTime() - WEEK_MS
  const recent = events.filter((e) => Date.parse(e.createdAt) >= since)
  const views = new Map<string, number>()
  for (const e of recent) {
    if (e.type === 'cta_click') return true
    if (e.type === 'scroll_depth' && depth(e) >= 75) return true
    if (e.type === 'page_view') views.set(e.visitorId, (views.get(e.visitorId) ?? 0) + 1)
  }
  return [...views.values()].some((n) => n >= 2)
}

export function engagementSummary(
  campaignId: string,
  events: StoredEvent[],
  meetings: Meeting[],
  now: Date,
): EngagementSummary {
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const count = (t: StoredEvent['type']) => sorted.filter((e) => e.type === t).length
  const booked = count('meeting_booked')
  return {
    campaignId,
    visitors: new Set(sorted.map((e) => e.visitorId)).size,
    views: count('page_view'),
    maxScroll: sorted
      .filter((e) => e.type === 'scroll_depth')
      .reduce((m, e) => Math.max(m, depth(e)), 0),
    ctaClicks: count('cta_click'),
    formStarts: count('form_start'),
    formSubmits: count('form_submit'),
    meetings: Math.max(booked, meetings.length),
    lastActiveAt: sorted.at(-1)?.createdAt ?? null,
    hot: isHot(sorted, now),
    timeline: sorted
      .slice(-300)
      .reverse()
      .map((e) => ({
        at: e.createdAt,
        visitorId: e.visitorId,
        type: e.type,
        props: { ...e.props },
      })),
    illustrative: sorted.some((e) => e.props?.illustrative === true),
  }
}

function rates(events: StoredEvent[]) {
  const visitors = new Set<string>()
  const forms = new Set<string>()
  const meetings = new Set<string>()
  for (const e of events) {
    if (e.type === 'page_view') visitors.add(e.visitorId)
    if (e.type === 'form_submit') forms.add(e.visitorId)
    if (e.type === 'meeting_booked') meetings.add(e.visitorId)
  }
  const n = visitors.size
  const share = (s: Set<string>) => (n ? [...s].filter((v) => visitors.has(v)).length / n : 0)
  return { visitors: n, formRate: share(forms), meetingRate: share(meetings) }
}

/** Account pages vs generic /solutions pages. No winner below 100 visitors per side. */
export function conversionComparison(
  accountEvents: StoredEvent[],
  genericEvents: StoredEvent[],
): ConversionComparison {
  const account = rates(accountEvents)
  const generic = rates(genericEvents)
  return {
    account,
    generic,
    insufficientSample: account.visitors < MIN_SAMPLE || generic.visitors < MIN_SAMPLE,
    illustrative: [...accountEvents, ...genericEvents].some((e) => e.props?.illustrative === true),
  }
}

function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2)
}

export interface ReviewMetrics {
  avgClaims: number
  pctSourced: number
  pctRejected: number
  medianBriefToReviewMs: number
  medianBriefToPublishMs: number
}

/** Claims per page, % sourced (of factual claims), % rejected, brief → review-ready / publish. */
export function reviewMetrics(campaigns: Campaign[], currentClaims: Claim[]): ReviewMetrics {
  const versions = new Set(currentClaims.map((c) => c.versionId))
  const factual = currentClaims.filter((c) => c.kind !== 'positioning')
  const round = (n: number) => Math.round(n * 1000) / 1000
  return {
    avgClaims: versions.size ? round(currentClaims.length / versions.size) : 0,
    pctSourced: factual.length
      ? round(factual.filter((c) => c.sources.length > 0).length / factual.length)
      : 0,
    pctRejected: currentClaims.length
      ? round(currentClaims.filter((c) => c.status === 'rejected').length / currentClaims.length)
      : 0,
    medianBriefToReviewMs: median(
      campaigns
        .filter((c) => c.reviewReadyAt)
        .map((c) => Date.parse(c.reviewReadyAt!) - Date.parse(c.briefAt)),
    ),
    medianBriefToPublishMs: median(
      campaigns
        .filter((c) => c.publishedAt)
        .map((c) => Date.parse(c.publishedAt!) - Date.parse(c.briefAt)),
    ),
  }
}
