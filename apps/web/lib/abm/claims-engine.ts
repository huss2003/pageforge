import {
  certificationNames,
  customerNames,
  fieldRoot,
  hasNumber,
  looseIncludes,
  pageIssues,
  productFactsFrom,
  splitSentences,
  textUnder,
  validateClaims,
  INDUSTRY_SITE_TYPE,
  type AccountFact,
  type CheckableClaim,
  type ProductFact,
} from '@pageforge/agents'
import type { Page } from '@pageforge/blocks'
import { facts } from '@pageforge/content'
import type { NewClaim } from './store'
import type { Claim, Industry, Source, SourceFact } from './types'

/**
 * Glue between the agents' claim validator and stored claims: builds the
 * validator inputs, applies the status rules and derives publish blockers.
 */
export function productFactsFor(industry: Industry): ProductFact[] {
  return productFactsFrom(facts, INDUSTRY_SITE_TYPE[industry])
}

export function accountFactsFrom(sourceFacts: SourceFact[], sources: Source[]): AccountFact[] {
  const urls = new Map(sources.map((s) => [s.id, s.url]))
  return sourceFacts
    .filter((f) => f.included)
    .map((f) => ({
      id: f.id,
      quote: f.quote,
      url: urls.get(f.sourceId) ?? '',
      category: f.category,
    }))
}

export interface RevalidateInput {
  page: Page
  claims: (NewClaim | Claim)[]
  industry: Industry
  accountFacts: AccountFact[]
  accountName?: string
}

/**
 * Re-run the validator over every claim. Status rules:
 * - a claim nobody has reviewed follows the validator (ok → supported, else needs_review);
 * - a reviewer's decision is kept;
 * - new "Unsourced statement" claims are added as needs_review.
 */
export function revalidate(input: RevalidateInput): NewClaim[] {
  const productFacts = productFactsFor(input.industry)
  const checkable = input.claims as CheckableClaim[]
  const v = validateClaims(input.page, checkable, {
    productFacts,
    accountFacts: input.accountFacts,
    bannedPhrases: facts.voice.bannedPhrases,
    customerNames: customerNames(facts),
    certificationNames: certificationNames(facts),
    accountName: input.accountName,
  })
  const out: NewClaim[] = input.claims.map((c, i) => {
    const check = v.checks[i]!
    const reviewed = Boolean(c.reviewedBy)
    return {
      ...('id' in c && c.id ? { id: c.id } : {}),
      blockKey: c.blockKey,
      field: c.field,
      text: c.text,
      kind: c.kind,
      sources: c.sources,
      status:
        reviewed || c.status === 'rejected' ? c.status : check.ok ? 'supported' : 'needs_review',
      validator: check,
      reviewedBy: c.reviewedBy ?? null,
      reviewedAt: c.reviewedAt ?? null,
      note: c.note ?? null,
      ...(c.origin ? { origin: c.origin } : {}),
    }
  })
  for (const u of v.unsourced) {
    out.push({
      blockKey: u.claim.blockKey,
      field: u.claim.field,
      text: u.claim.text,
      kind: u.claim.kind,
      sources: [],
      status: 'needs_review',
      validator: u.check,
      reviewedBy: null,
      reviewedAt: null,
      note: null,
      origin: 'validator',
    })
  }
  return out
}

/** Why a version cannot be approved or published right now. */
export function publishBlockers(page: Page, claims: Pick<Claim, 'status'>[]): string[] {
  const blockers: string[] = []
  const pending = claims.filter((c) => c.status === 'needs_review').length
  if (pending)
    blockers.push(
      `${pending} claim${pending === 1 ? '' : 's'} need${pending === 1 ? 's' : ''} review.`,
    )
  blockers.push(...pageIssues(page, facts.voice.bannedPhrases))
  return blockers
}

/**
 * After a field edit: claims in the edited field go back to needs_review,
 * claims whose text is gone are dropped, and new text that no claim covers
 * becomes an 'edit' claim for the reviewer.
 */
export function claimsAfterEdit(
  page: Page,
  claims: Claim[],
  edits: { blockKey: string; field: string }[],
): NewClaim[] {
  const out: NewClaim[] = []
  const touched = new Set(edits.map((e) => `${e.blockKey}|${fieldRoot(e.field)}`))
  const blocks = new Map(page.blocks.map((b) => [b._key, b]))
  for (const c of claims) {
    const key = `${c.blockKey}|${fieldRoot(c.field)}`
    if (!touched.has(key)) {
      out.push(c)
      continue
    }
    const block = blocks.get(c.blockKey)
    const where = block ? textUnder(block, fieldRoot(c.field)) : ''
    if (c.status === 'rejected') {
      out.push(c)
      continue
    }
    if (!looseIncludes(where, c.text)) continue
    out.push({ ...c, status: 'needs_review', reviewedBy: null, reviewedAt: null, note: null })
  }
  for (const e of edits) {
    const block = blocks.get(e.blockKey)
    if (!block) continue
    const root = fieldRoot(e.field)
    const live = out.filter(
      (c) => c.blockKey === e.blockKey && fieldRoot(c.field) === root && c.status !== 'rejected',
    )
    const value = textUnder(block, e.field)
    const uncovered = splitSentences(value).filter(
      (s) => !live.some((c) => looseIncludes(s, c.text) || looseIncludes(c.text, s)),
    )
    if (!uncovered.length) continue
    const text = uncovered.join(' ')
    out.push({
      blockKey: e.blockKey,
      field: e.field,
      text,
      kind: hasNumber(text) ? 'product_fact' : 'positioning',
      sources: [],
      status: 'needs_review',
      validator: { ok: false, reasons: [] },
      reviewedBy: null,
      reviewedAt: null,
      note: null,
      origin: 'edit',
    })
  }
  return out
}

/** A stored claim as input for a new version (id and version id dropped). */
export function asNewClaim(c: Claim): NewClaim {
  const { id, versionId, ...rest } = c
  void id
  void versionId
  return rest
}
