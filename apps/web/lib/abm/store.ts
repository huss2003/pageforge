import type {
  Account,
  ActorRole,
  AuditEntry,
  Campaign,
  CampaignStatus,
  CampaignType,
  Claim,
  Industry,
  Lead,
  Meeting,
  Source,
  SourceFact,
  TrackEvent,
  Version,
  Workspace,
} from './types'

/**
 * Storage interface for ABM data. Two implementations share it:
 * `memory-store.ts` (demo without Supabase, one server instance) and
 * `supabase-store.ts` (tables pf_abm_* from migration 0002).
 *
 * Workspace isolation: accounts, campaigns and audit rows carry a
 * workspace; everything else is reached through its campaign or account.
 */
export type NewAccount = Omit<Account, 'id' | 'createdAt'> & { createdAt?: string }
export type NewCampaign = Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string }
export type CampaignPatch = Partial<Omit<Campaign, 'id' | 'workspace' | 'createdAt' | 'updatedAt'>>

export interface SourceRecord extends Source {
  contentHash: string | null
}
export type NewSource = Omit<SourceRecord, 'id' | 'accountId'>
export type NewSourceFact = Pick<SourceFact, 'quote' | 'category' | 'included'>

export type NewVersion = Omit<Version, 'id' | 'createdAt'> & { createdAt?: string }
export type VersionPatch = Partial<
  Pick<
    Version,
    'state' | 'page' | 'seo' | 'cta' | 'model' | 'simulated' | 'approvedBy' | 'approvedAt'
  >
>
export type NewClaim = Omit<Claim, 'id' | 'versionId'> & { id?: string }
export type ClaimPatch = Partial<Omit<Claim, 'id' | 'versionId'>>

export interface StoredEvent extends TrackEvent {
  id: number
  createdAt: string
  props: Record<string, string | number | boolean>
  utm: Partial<Record<'source' | 'medium' | 'campaign' | 'content' | 'term', string>>
}
export type NewEvent = TrackEvent & { createdAt?: string }

export type NewLead = Omit<Lead, 'id' | 'createdAt'> & { createdAt?: string }
export type LeadPatch = Partial<
  Pick<Lead, 'crmProvider' | 'crmId' | 'crmStatus' | 'crmError' | 'role' | 'message'>
>
export type NewMeeting = Omit<Meeting, 'id' | 'createdAt' | 'illustrative'> & { createdAt?: string }

export interface NewAudit {
  workspace: Workspace
  campaignId: string | null
  actorRole: ActorRole
  action: string
  detail?: Record<string, unknown>
  createdAt?: string
}

export interface CampaignQuery {
  type?: CampaignType
  slug?: string
  industry?: Industry
  status?: CampaignStatus[]
  workspace?: Workspace
}

export interface EventQuery {
  campaignIds?: string[]
  pageKind?: TrackEvent['pageKind']
  /** Events with no campaign (generic pages without a published campaign). */
  withoutCampaign?: boolean
  since?: Date
  limit?: number
}

export interface AbmStore {
  readonly kind: 'memory' | 'supabase'

  createAccount(input: NewAccount): Promise<Account>
  getAccount(id: string): Promise<Account | null>

  createCampaign(input: NewCampaign): Promise<Campaign>
  getCampaign(id: string): Promise<Campaign | null>
  updateCampaign(id: string, patch: CampaignPatch): Promise<Campaign>
  /** Campaigns of one workspace, newest first; `since` hides older rows. */
  listCampaigns(workspace: Workspace, opts?: { since?: Date }): Promise<Campaign[]>
  /** Search across workspaces (public routes and slug checks). */
  findCampaigns(query: CampaignQuery): Promise<Campaign[]>

  /** Replace an account's sources and facts with a fresh fetch. */
  replaceSources(
    accountId: string,
    items: { source: NewSource; facts: NewSourceFact[] }[],
  ): Promise<{ sources: SourceRecord[]; facts: SourceFact[] }>
  listSources(accountId: string): Promise<SourceRecord[]>
  listFacts(accountId: string): Promise<SourceFact[]>
  setFactIncluded(accountId: string, factId: string, included: boolean): Promise<SourceFact | null>

  createVersion(
    input: NewVersion,
    claims: NewClaim[],
  ): Promise<{ version: Version; claims: Claim[] }>
  getVersion(id: string): Promise<Version | null>
  updateVersion(id: string, patch: VersionPatch): Promise<Version>
  deleteVersion(id: string): Promise<void>
  listVersions(campaignId: string): Promise<Version[]>

  listClaims(versionId: string): Promise<Claim[]>
  listClaimsForVersions(versionIds: string[]): Promise<Claim[]>
  getClaim(id: string): Promise<Claim | null>
  updateClaim(id: string, patch: ClaimPatch): Promise<Claim>
  /** Replace all claims of a version; claims with an `id` keep it. */
  replaceClaims(versionId: string, claims: NewClaim[]): Promise<Claim[]>

  addEvents(events: NewEvent[]): Promise<void>
  listEvents(query: EventQuery): Promise<StoredEvent[]>

  createLead(input: NewLead): Promise<Lead>
  getLead(id: string): Promise<Lead | null>
  updateLead(id: string, patch: LeadPatch): Promise<Lead>
  /** Leads of these campaigns; `withoutCampaign` adds leads from generic pages with no campaign. */
  listLeads(campaignIds: string[], opts?: { withoutCampaign?: boolean }): Promise<Lead[]>
  findLeadByEmail(campaignId: string, email: string): Promise<Lead | null>

  /** Returns null when the slot is already booked for this campaign. */
  createMeeting(input: NewMeeting): Promise<Meeting | null>
  listMeetings(campaignIds: string[]): Promise<Meeting[]>

  audit(entry: NewAudit): Promise<void>
  listAudit(campaignId: string): Promise<AuditEntry[]>

  /** Increments a per-UTC-day counter; true while within `limit`. */
  hitRateLimit(key: string, limit: number): Promise<boolean>

  /** Delete demo-workspace accounts, campaigns and audit rows created before `before`. */
  purgeDemo(before: Date): Promise<number>
}
