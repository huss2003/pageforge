/**
 * Typed fetch wrappers for /api/abm/* (desk and public account pages).
 *
 * Fixture mode: with NEXT_PUBLIC_ABM_FIXTURES=1 every call is answered by an
 * in-memory copy of the API in `fixtures.ts` (kept in localStorage so a
 * reload keeps the demo's state), with simulated latency. It exists for
 * local visual testing and screenshots; it never runs in a normal build.
 */
import type {
  AccountBrief,
  AuditEntry,
  Campaign,
  CampaignDetail,
  ConversionComparison,
  CtaConfig,
  EngagementSummary,
  Lead,
  Role,
  SeoConfig,
  SourceFact,
  Source,
  TrackEvent,
  VersionWithClaims,
  Workspace,
} from './types'
import type { FixtureDb } from './fixtures'

export class ApiError extends Error {
  readonly status: number
  readonly fields: Record<string, string>
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

export interface Session {
  workspace: Workspace
  role: Role
  /** True when Gemini/Groq keys are set; false in simulation. */
  liveModels: boolean
}

export type CampaignRow = Campaign & {
  accountName: string | null
  claimsNeedingReview: number
  hot: boolean
}

export interface ReviewMetrics {
  avgClaims: number
  pctSourced: number
  pctRejected: number
  medianBriefToReviewMs: number | null
  medianBriefToPublishMs: number | null
}

export interface Overview {
  comparison: ConversionComparison
  review: ReviewMetrics
}

export type VersionEdit = { blockKey: string; field: string; value: unknown }

export function fixturesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ABM_FIXTURES === '1'
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

const FIXTURE_KEY = 'pf_abm_fixtures_v1'
let memoryDb: FixtureDb | null = null

/** Simulated network latency for fixture mode, in ms. */
export let fixtureLatency = { min: 120, max: 380 }
export function setFixtureLatency(min: number, max = min): void {
  fixtureLatency = { min, max }
}

async function loadFixtureDb(): Promise<FixtureDb> {
  const { seedDb } = await import('./fixtures')
  if (memoryDb) return memoryDb
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(FIXTURE_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as FixtureDb
      if (parsed?.v === 1) {
        memoryDb = parsed
        return parsed
      }
    }
  } catch {
    // Storage unavailable or corrupt: start from the seed.
  }
  memoryDb = seedDb()
  return memoryDb
}

function saveFixtureDb(db: FixtureDb): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(FIXTURE_KEY, JSON.stringify(db))
  } catch {
    // Not persisted; the in-memory copy still works for this tab.
  }
}

/** Forget fixture state (tests and the "Reset demo data" link). */
export function resetFixtures(): void {
  memoryDb = null
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(FIXTURE_KEY)
  } catch {
    // ignore
  }
}

function delay(): Promise<void> {
  const { min, max } = fixtureLatency
  const ms = min + Math.random() * Math.max(0, max - min)
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()
}

async function viaFixtures<T>(method: string, path: string, body?: unknown): Promise<T> {
  const [{ handleFixture }, db] = await Promise.all([import('./fixtures'), loadFixtureDb()])
  await delay()
  const res = handleFixture(
    db,
    method,
    path,
    body === undefined ? undefined : structuredClone(body),
  )
  saveFixtureDb(db)
  if (res.status >= 400) {
    const err = res.body as { error?: string; fields?: Record<string, string> }
    throw new ApiError(res.status, err?.error ?? `Request failed (${res.status}).`, err?.fields)
  }
  return (res.status === 204 ? undefined : structuredClone(res.body)) as T
}

async function viaNetwork<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as
    (T & { error?: string; fields?: Record<string, string> }) | null
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error ?? `The server answered ${res.status}. Try again in a moment.`,
      data?.fields ?? {},
    )
  }
  return data as T
}

export function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return fixturesEnabled() ? viaFixtures<T>(method, path, body) : viaNetwork<T>(method, path, body)
}

const enc = encodeURIComponent

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Null when there is no session (401). */
export async function getSession(): Promise<Session | null> {
  try {
    const s = await request<Partial<Session>>('GET', '/api/abm/session')
    if (!s?.role || !s.workspace) return null
    return { workspace: s.workspace, role: s.role, liveModels: Boolean(s.liveModels) }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

export function startSession(input: {
  role: Role
  workspace?: Workspace
  password?: string
}): Promise<{ workspace: Workspace; role: Role }> {
  return request('POST', '/api/abm/session', input)
}

export function endSession(): Promise<void> {
  return request('DELETE', '/api/abm/session')
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function listCampaigns(): Promise<CampaignRow[]> {
  return (await request<{ campaigns: CampaignRow[] }>('GET', '/api/abm/campaigns')).campaigns
}

export function createCampaign(brief: AccountBrief): Promise<{ campaignId: string }> {
  return request('POST', '/api/abm/campaigns', brief)
}

export function getCampaign(id: string): Promise<CampaignDetail> {
  return request('GET', `/api/abm/campaigns/${enc(id)}`)
}

export function gatherSources(
  id: string,
  urls?: string[],
): Promise<{ sources: Source[]; facts: SourceFact[] }> {
  return request('POST', `/api/abm/campaigns/${enc(id)}/sources`, urls ? { urls } : {})
}

export function setFactsIncluded(
  id: string,
  changes: { factId: string; included: boolean }[],
): Promise<{ facts: SourceFact[] }> {
  return request('PATCH', `/api/abm/campaigns/${enc(id)}/facts`, changes)
}

export function generateDraft(id: string): Promise<{ versionId: string }> {
  return request('POST', `/api/abm/campaigns/${enc(id)}/draft`)
}

export function publishCampaign(
  id: string,
  versionId: string,
  opts: { expiresAt?: string | null } = {},
): Promise<{ liveUrl: string }> {
  return request('POST', `/api/abm/campaigns/${enc(id)}/publish`, { versionId, ...opts })
}

export function pauseCampaign(id: string): Promise<Campaign> {
  return request('POST', `/api/abm/campaigns/${enc(id)}/pause`)
}

export function resumeCampaign(id: string): Promise<Campaign> {
  return request('POST', `/api/abm/campaigns/${enc(id)}/resume`)
}

export function rollbackCampaign(id: string, versionId: string): Promise<{ liveUrl: string }> {
  return request('POST', `/api/abm/campaigns/${enc(id)}/rollback`, { versionId })
}

export function duplicateCampaign(
  id: string,
  brief: AccountBrief,
): Promise<{ campaignId: string }> {
  return request('POST', `/api/abm/campaigns/${enc(id)}/duplicate`, { brief })
}

export function getEngagement(id: string): Promise<EngagementSummary> {
  return request('GET', `/api/abm/campaigns/${enc(id)}/engagement`)
}

export async function getAudit(id: string): Promise<AuditEntry[]> {
  return (await request<{ entries: AuditEntry[] }>('GET', `/api/abm/campaigns/${enc(id)}/audit`))
    .entries
}

// ---------------------------------------------------------------------------
// Versions and claims
// ---------------------------------------------------------------------------

export function editVersion(
  versionId: string,
  change: VersionEdit[] | { cta: CtaConfig } | { seo: Partial<SeoConfig> },
): Promise<VersionWithClaims> {
  return request('PATCH', `/api/abm/versions/${enc(versionId)}`, change)
}

export function submitVersion(versionId: string): Promise<VersionWithClaims> {
  return request('POST', `/api/abm/versions/${enc(versionId)}/submit`)
}

export function reviewClaim(
  claimId: string,
  status: 'supported' | 'rejected' | 'needs_review',
  note?: string,
): Promise<VersionWithClaims> {
  return request('PATCH', `/api/abm/claims/${enc(claimId)}`, note ? { status, note } : { status })
}

export function approveVersion(versionId: string, note?: string): Promise<VersionWithClaims> {
  return request('POST', `/api/abm/versions/${enc(versionId)}/approve`, note ? { note } : {})
}

export function requestChanges(versionId: string, note: string): Promise<VersionWithClaims> {
  return request('POST', `/api/abm/versions/${enc(versionId)}/request-changes`, { note })
}

// ---------------------------------------------------------------------------
// Overview and leads
// ---------------------------------------------------------------------------

export function getOverview(): Promise<Overview> {
  return request('GET', '/api/abm/overview')
}

export async function listLeads(): Promise<Lead[]> {
  return (await request<{ leads: Lead[] }>('GET', '/api/abm/leads')).leads
}

// ---------------------------------------------------------------------------
// Public (account pages)
// ---------------------------------------------------------------------------

export async function getSlots(campaignId: string | null): Promise<string[]> {
  const q = campaignId ? `?campaignId=${enc(campaignId)}` : ''
  return (await request<{ slots: string[] }>('GET', `/api/abm/slots${q}`)).slots
}

export function bookMeeting(input: {
  campaignId: string | null
  leadId?: string
  visitorId: string
  slotStart: string
  timezone: string
  name: string
  email: string
  company: string
  turnstileToken?: string | null
}): Promise<{ meetingId: string }> {
  return request('POST', '/api/abm/meetings', input)
}

export function submitLead(input: {
  campaignId: string | null
  versionId: string | null
  visitorId: string
  fields: Record<string, string>
  utm: TrackEvent['utm']
  turnstileToken?: string | null
}): Promise<{ leadId: string }> {
  return request('POST', '/api/abm/leads', input)
}
