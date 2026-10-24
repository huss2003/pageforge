import type { Page, SiteType } from '@pageforge/blocks'

/**
 * ABM drafting types. They mirror apps/web/lib/abm/types.ts structurally
 * (this package cannot import the app), so the app passes its own objects in.
 */
export type AbmIndustry = 'ports' | 'refineries' | 'power-grids' | 'open-pit-mining' | 'solar'
export type AbmCampaignType = 'demo' | 'campaign' | 'solutions'
export type AbmGoal = 'book-meeting' | 'download-report' | 'event-invite'
export type FactCategory = 'operations' | 'scale' | 'initiatives' | 'challenges' | 'other'
export type ClaimKind = 'product_fact' | 'account_fact' | 'positioning'
export type ClaimStatus = 'supported' | 'needs_review' | 'rejected'
/** Who created a claim: the drafting model, the validator (unsourced statement) or an edit. */
export type ClaimOrigin = 'draft' | 'validator' | 'edit'

export interface AbmBrief {
  companyName: string
  industry: AbmIndustry
  siteCount?: number
  campaignType: AbmCampaignType
  goal: AbmGoal
  painPoints: string[]
  targetRole: string
  salesNotes?: string
}

/** One approved Hoverline fact, flattened from BrandFacts with a namespaced id. */
export interface ProductFact {
  /** e.g. "stat:night-patrols", "capability:dock", "faq:airspace", "site:port:findings". */
  id: string
  /** Short human label for the review screen. */
  label: string
  /** Full text the claim must be supported by. */
  text: string
}

/** An included, verbatim sentence from the prospect's public pages. */
export interface AccountFact {
  id: string
  quote: string
  url: string
  category: FactCategory
}

export type ClaimSource =
  | { type: 'product_fact'; factId: string; label: string }
  | { type: 'account_source'; sourceFactId: string; url: string; quote: string }

export interface DraftClaim {
  blockKey: string
  /** Path inside the block, e.g. "subheading", "stats[1]", "items[0].answer". */
  field: string
  text: string
  kind: ClaimKind
  sources: ClaimSource[]
  /** Fact ids the model cited that do not exist (kept so the validator can say so). */
  unresolved?: string[]
  origin?: ClaimOrigin
}

/** A claim as the validator sees it: draft claims plus review state. */
export interface CheckableClaim extends DraftClaim {
  id?: string
  status?: ClaimStatus
}

export interface ClaimCheck {
  ok: boolean
  reasons: string[]
}

export interface DraftResult {
  page: Page
  claims: DraftClaim[]
  model: string
  /** Number of model calls made (1, or 2 with a repair). */
  calls: number
}

export interface SelectedFact {
  /** Index into the sentences array passed in. */
  index: number
  category: FactCategory
}

export const INDUSTRY_SITE_TYPE: Record<AbmIndustry, SiteType> = {
  ports: 'port',
  refineries: 'refinery',
  'power-grids': 'substation',
  'open-pit-mining': 'open-pit',
  solar: 'solar-farm',
}
