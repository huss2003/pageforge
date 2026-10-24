/**
 * PageForge ABM — shared contract between the backend (lib/abm/*, app/api/abm/*)
 * and the UI (app/abm/*, public account routes). See docs/abm-spec.md.
 *
 * Field names mirror supabase/migrations/0002_abm.sql in camelCase.
 */
import type { Page } from '@pageforge/blocks'

export type Workspace = 'demo' | 'main'
export type Role = 'marketer' | 'sales' | 'reviewer' | 'admin'
export type ActorRole = Role | 'system'

export type CampaignType = 'demo' | 'campaign' | 'solutions'
export type CampaignGoal = 'book-meeting' | 'download-report' | 'event-invite'
export type CampaignStatus =
  | 'draft'
  | 'generating'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'paused'
  | 'expired'
  | 'archived'

export type Industry = 'ports' | 'refineries' | 'power-grids' | 'open-pit-mining' | 'solar'

// ---------------------------------------------------------------------------
// Brief and account
// ---------------------------------------------------------------------------

export interface AccountBrief {
  companyName: string // ≤ 80
  companyUrl: string // http(s), ≤ 300
  industry: Industry
  siteCount?: number // 1–10000
  campaignType: CampaignType
  goal: CampaignGoal
  painPoints: string[] // 0–6 items, each ≤ 120
  targetRole: string // ≤ 60
  sourceChannel: 'email' | 'linkedin' | 'sales-sequence' | 'event' | 'paid' | 'other'
  salesNotes?: string // ≤ 600
  expiresInDays?: number // default 60 for demo/campaign, none for solutions
}

export interface Account {
  id: string
  workspace: Workspace
  createdAt: string
  name: string
  url: string
  domain: string
  industry: Industry
  siteCount: number | null
  targetRole: string | null
  painPoints: string[]
  salesNotes: string | null
  createdBy: ActorRole
}

// ---------------------------------------------------------------------------
// Public context (sources)
// ---------------------------------------------------------------------------

export type SourceStatus = 'ok' | 'robots_disallowed' | 'blocked' | 'failed'
export type FactCategory = 'operations' | 'scale' | 'initiatives' | 'challenges' | 'other'

export interface Source {
  id: string
  accountId: string
  url: string
  title: string | null
  fetchedAt: string
  status: SourceStatus
  /** Human-readable reason for blocked/failed/robots states. */
  detail: string | null
}

export interface SourceFact {
  id: string
  sourceId: string
  accountId: string
  /** Verbatim sentence from the source page. */
  quote: string
  category: FactCategory
  included: boolean
}

// ---------------------------------------------------------------------------
// Versions and claims
// ---------------------------------------------------------------------------

export type ClaimKind = 'product_fact' | 'account_fact' | 'positioning'
export type ClaimStatus = 'supported' | 'needs_review' | 'rejected'
/** Who created a claim: the drafting model, the validator ("Unsourced statement") or an edit. */
export type ClaimOrigin = 'draft' | 'validator' | 'edit'

export type ClaimSource =
  | { type: 'product_fact'; factId: string; label: string }
  | { type: 'account_source'; sourceFactId: string; url: string; quote: string }

export interface Claim {
  id: string
  versionId: string
  blockKey: string
  /** Path inside the block, e.g. "subheading", "stats[1].value". */
  field: string
  text: string
  kind: ClaimKind
  sources: ClaimSource[]
  status: ClaimStatus
  validator: { ok: boolean; reasons: string[] }
  reviewedBy: ActorRole | null
  reviewedAt: string | null
  note: string | null
  /** Added: where the claim came from. 'validator' = auto-created "Unsourced statement". */
  origin?: ClaimOrigin
}

export type VersionOrigin = 'ai_draft' | 'edit' | 'duplicate' | 'rollback'
export type VersionState = 'draft' | 'in_review' | 'approved' | 'changes_requested'

export interface CtaConfig {
  label: string // ≤ 32, says what happens
  kind: 'calendar' | 'form'
  /** Form fields shown; name + work email + company are always on. */
  formFields: ('role' | 'phone' | 'message' | 'siteCount')[]
}

export interface SeoConfig {
  title: string // ≤ 60
  description: string // ≤ 160
  noindex: boolean
  canonicalUrl: string
  ogImageUrl: string
}

export interface Version {
  id: string
  campaignId: string
  number: number
  createdAt: string
  createdBy: ActorRole
  origin: VersionOrigin
  state: VersionState
  page: Page
  seo: SeoConfig
  cta: CtaConfig
  model: string | null
  simulated: boolean
  approvedBy: ActorRole | null
  approvedAt: string | null
}

export interface VersionWithClaims extends Version {
  claims: Claim[]
  /** Derived: publish is blocked while any claim needs review or validation fails. */
  publishBlockers: string[]
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export interface TrackingLink {
  channel: AccountBrief['sourceChannel']
  url: string // absolute, with utm_source/medium/campaign/content
}

export interface Campaign {
  id: string
  workspace: Workspace
  createdAt: string
  updatedAt: string
  accountId: string | null // null for solutions pages
  type: CampaignType
  industry: Industry
  goal: CampaignGoal
  sourceChannel: string | null
  status: CampaignStatus
  slug: string
  /** Only for private demo pages; never sent to the public. */
  token: string | null
  utmCampaign: string
  expiresAt: string | null
  noindex: boolean
  currentVersionId: string | null
  publishedVersionId: string | null
  publishedAt: string | null
  briefAt: string
  reviewReadyAt: string | null
  createdBy: ActorRole
}

export interface CampaignDetail extends Campaign {
  account: Account | null
  sources: Source[]
  facts: SourceFact[]
  versions: Pick<Version, 'id' | 'number' | 'createdAt' | 'origin' | 'state' | 'createdBy'>[]
  current: VersionWithClaims | null
  /** Absolute public URL when published (includes token for private pages). */
  liveUrl: string | null
  trackingLinks: TrackingLink[]
  /** Added: last draft failure (redacted), shown while status is back to 'draft'. */
  lastError?: string | null
  /** Added: true when the campaign was created by the demo seed (metrics are illustrative). */
  illustrative?: boolean
}

// ---------------------------------------------------------------------------
// Analytics, CRM, calendar
// ---------------------------------------------------------------------------

export type EventType =
  'page_view' | 'scroll_depth' | 'cta_click' | 'form_start' | 'form_submit' | 'meeting_booked'

export interface TrackEvent {
  campaignId: string | null // null on generic /solutions pages without a campaign
  versionId: string | null
  pageKind: 'account' | 'generic'
  path: string
  visitorId: string // random, first-party, ≤ 64
  type: EventType
  props?: Record<string, string | number | boolean>
  utm?: Partial<Record<'source' | 'medium' | 'campaign' | 'content' | 'term', string>>
}

export interface Lead {
  id: string
  createdAt: string
  campaignId: string | null
  accountId: string | null
  visitorId: string | null
  name: string
  email: string
  company: string
  role: string | null
  message: string | null
  pageUrl: string
  utm: Record<string, string>
  crmProvider: 'builtin' | 'hubspot'
  crmId: string | null
  crmStatus: 'synced' | 'pending' | 'failed'
  crmError: string | null
  /** Added: seed data, labelled "illustrative" in the UI. */
  illustrative?: boolean
  /** Added: start of the meeting booked by this lead (GET /api/abm/leads only). */
  meetingAt?: string | null
}

export interface Meeting {
  id: string
  createdAt: string
  campaignId: string | null
  leadId: string | null
  slotStart: string
  timezone: string
  /** Added: seed data, labelled "illustrative" in the UI. */
  illustrative?: boolean
}

export interface EngagementSummary {
  campaignId: string
  visitors: number
  views: number
  maxScroll: number
  ctaClicks: number
  formStarts: number
  formSubmits: number
  meetings: number
  lastActiveAt: string | null
  hot: boolean
  timeline: { at: string; visitorId: string; type: EventType; props: Record<string, unknown> }[]
  /** Added: true when any event shown is illustrative seed data. */
  illustrative?: boolean
}

export interface ConversionComparison {
  account: { visitors: number; formRate: number; meetingRate: number }
  generic: { visitors: number; formRate: number; meetingRate: number }
  /** True when either side has < 100 visitors: no winner may be declared. */
  insufficientSample: boolean
  illustrative: boolean
}

export interface AuditEntry {
  id: number
  createdAt: string
  campaignId: string | null
  actorRole: ActorRole
  action: string
  detail: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Added: session and runtime mode (GET /api/abm/session)
// ---------------------------------------------------------------------------

export interface AbmMode {
  /** 'simulated' when no Gemini/Groq key is set (FakeLlm drafts). */
  models: 'live' | 'simulated'
  storage: 'supabase' | 'memory'
  crm: 'hubspot' | 'builtin'
  /** The main workspace can be unlocked (FACTORY_ADMIN_PASSWORD is set). */
  workspacePasswordEnabled: boolean
  turnstileSiteKey: string | null
  limits: { draftsPerIpPerDay: number; draftsPerDay: number }
}

export interface SessionInfo {
  workspace: Workspace
  role: Role
  /** True when Gemini/Groq keys are set; false in simulation. */
  liveModels: boolean
  mode: AbmMode
}

// ---------------------------------------------------------------------------
// API contract (Route Handlers under /api/abm). All JSON, cache: no-store.
// Session cookie carries { workspace, role }. Errors: { error: string, fields? }.
// ---------------------------------------------------------------------------
//
// POST   /api/abm/session                 { role, workspace?, password? } → { workspace, role }
// GET    /api/abm/session                 → SessionInfo { workspace, role, liveModels, mode } | 401   (added)
// DELETE /api/abm/session                 → 204
// GET    /api/abm/campaigns               → { campaigns: (Campaign & { accountName, claimsNeedingReview, hot })[] }
// POST   /api/abm/campaigns               AccountBrief → 201 { campaignId }   (creates account + campaign, status draft)
// GET    /api/abm/campaigns/[id]          → CampaignDetail
// POST   /api/abm/campaigns/[id]/sources  { urls?: string[] } → { sources, facts }        (fetch public context)
// PATCH  /api/abm/campaigns/[id]/facts    { factId, included }[] → { facts }
// POST   /api/abm/campaigns/[id]/draft    → 202 { versionId }   (AI draft; status generating → in_review)
// PATCH  /api/abm/versions/[id]           { blockKey, field, value }[] | { cta } | { seo } → VersionWithClaims (creates 'edit' version if current is approved)
// POST   /api/abm/versions/[id]/submit    → VersionWithClaims (state in_review)
// PATCH  /api/abm/claims/[id]             { status: 'supported'|'rejected'|'needs_review', note? } → VersionWithClaims   (reviewer only)
// POST   /api/abm/versions/[id]/approve   { note? } → VersionWithClaims   (reviewer only; blocked by publishBlockers)
// POST   /api/abm/versions/[id]/request-changes { note } → VersionWithClaims (reviewer only)
// POST   /api/abm/campaigns/[id]/publish  { versionId, expiresAt?: ISO | null } → { liveUrl }   (marketer; version must be approved)
// POST   /api/abm/campaigns/[id]/pause    → Campaign
// POST   /api/abm/campaigns/[id]/resume   → Campaign
// POST   /api/abm/campaigns/[id]/rollback { versionId } → { liveUrl }  (republish an earlier approved version)
// POST   /api/abm/campaigns/[id]/duplicate { brief: AccountBrief } → 201 { campaignId }
// GET    /api/abm/campaigns/[id]/engagement → EngagementSummary
// GET    /api/abm/campaigns/[id]/audit    → { entries: AuditEntry[] }
// GET    /api/abm/leads                   → { leads: Lead[] }
// GET    /api/abm/overview                → { comparison: ConversionComparison, review: { avgClaims, pctSourced, pctRejected, medianBriefToReviewMs, medianBriefToPublishMs } }
// POST   /api/abm/events                  TrackEvent (beacon; public, rate-limited) → 204
// POST   /api/abm/leads                   { campaignId, versionId, visitorId, fields, utm, turnstileToken } → { leadId }   (public)
// GET    /api/abm/slots?campaignId=       → { slots: string[] }  (public; next 10 working days)
// POST   /api/abm/meetings                { campaignId, leadId?, visitorId, slotStart, timezone, name, email, company, turnstileToken } → { meetingId } (public)
