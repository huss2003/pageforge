import { blockSchema, type Block, type Page } from '@pageforge/blocks'
import type { Claim, ClaimStatus, VersionWithClaims } from '@/lib/abm/types'
import { blockLabels, fieldLabel, pathToField } from './labels'

/**
 * Pure helpers behind the review panel: claims grouped in page order and the
 * publish blockers list. Kept free of React so they are unit-tested.
 */

export interface ClaimGroup {
  blockKey: string
  /** Null when the block is no longer on the page (removed after a rejection). */
  blockType: Block['_type'] | null
  label: string
  claims: Claim[]
}

const statusOrder: Record<ClaimStatus, number> = { needs_review: 0, supported: 1, rejected: 2 }

/** Claims grouped by block, in the order the blocks appear on the page. */
export function groupClaimsByBlock(page: Pick<Page, 'blocks'>, claims: Claim[]): ClaimGroup[] {
  const typeCount = new Map<string, number>()
  const groups: ClaimGroup[] = page.blocks.map((b) => {
    const n = (typeCount.get(b._type) ?? 0) + 1
    typeCount.set(b._type, n)
    return {
      blockKey: b._key,
      blockType: b._type,
      label: n > 1 ? `${blockLabels[b._type]} ${n}` : blockLabels[b._type],
      claims: [],
    }
  })
  const byKey = new Map(groups.map((g) => [g.blockKey, g]))
  const orphans = new Map<string, ClaimGroup>()
  for (const c of claims) {
    const g = byKey.get(c.blockKey)
    if (g) {
      g.claims.push(c)
      continue
    }
    let o = orphans.get(c.blockKey)
    if (!o) {
      o = { blockKey: c.blockKey, blockType: null, label: 'Removed from the page', claims: [] }
      orphans.set(c.blockKey, o)
    }
    o.claims.push(c)
  }
  // Within a block: the ones that need a decision first, then field order is kept stable.
  const all = [...groups, ...orphans.values()]
  for (const g of all) {
    g.claims = g.claims
      .map((c, i) => ({ c, i }))
      .sort((a, b) => statusOrder[a.c.status] - statusOrder[b.c.status] || a.i - b.i)
      .map(({ c }) => c)
  }
  return all
}

export function claimCounts(claims: Claim[]): Record<ClaimStatus, number> & { total: number } {
  const out = { supported: 0, needs_review: 0, rejected: 0, total: claims.length }
  for (const c of claims) out[c.status]++
  return out
}

export interface Blocker {
  /** Stable key for React lists and de-duplication. */
  id: string
  text: string
  /** Block to highlight in the preview, when the blocker belongs to one. */
  blockKey?: string
  field?: string
  kind: 'review' | 'field' | 'approval' | 'validation'
}

function claimsNeedReview(n: number): string {
  return n === 1 ? '1 claim needs review' : `${n} claims need review`
}

interface IssueLike {
  code: string
  path: readonly PropertyKey[]
  message: string
  minimum?: number | bigint
  maximum?: number | bigint
  origin?: string
}

function blockerForIssue(
  block: Block,
  blockName: string,
  issue: IssueLike,
  rejected: Claim[],
): Blocker {
  const field = pathToField(issue.path)
  const what = fieldLabel(field).toLowerCase()
  const id = `field:${block._key}:${field}:${issue.code}`
  if (issue.code === 'too_small' && issue.origin === 'string') {
    const afterReject = rejected.some((c) => c.blockKey === block._key && c.field === field)
    return {
      id,
      kind: 'field',
      blockKey: block._key,
      field,
      text: `${blockName} ${what} is empty${afterReject ? ' after a rejected claim' : ''}`,
    }
  }
  if (issue.code === 'too_small' && issue.origin === 'array') {
    return {
      id,
      kind: 'field',
      blockKey: block._key,
      field,
      text: `${blockName} needs at least ${String(issue.minimum)} ${what || 'items'}`,
    }
  }
  if (issue.code === 'too_big' && issue.origin === 'string') {
    return {
      id,
      kind: 'field',
      blockKey: block._key,
      field,
      text: `${blockName} ${what} is over ${String(issue.maximum)} characters`,
    }
  }
  return {
    id,
    kind: 'field',
    blockKey: block._key,
    field,
    text: `${blockName}${what ? ` ${what}` : ''}: ${issue.message}`,
  }
}

/** Field problems on the page itself (empty after a rejection, too long after an edit). */
export function fieldBlockers(page: Pick<Page, 'blocks'>, claims: Claim[]): Blocker[] {
  const rejected = claims.filter((c) => c.status === 'rejected')
  const groups = groupClaimsByBlock(page, [])
  const out: Blocker[] = []
  page.blocks.forEach((block, i) => {
    const parsed = blockSchema.safeParse(block)
    if (parsed.success) return
    const name = groups[i]?.label ?? blockLabels[block._type]
    for (const issue of parsed.error.issues) {
      out.push(blockerForIssue(block, name, issue as IssueLike, rejected))
    }
  })
  return out
}

const reviewPattern = /\breview\b/i
const approvalPattern = /\bapprov/i

/**
 * Everything standing between this version and publishing, most specific
 * first. The server's list is the source of truth; the UI adds what it can
 * see itself (per-field problems) and words claim counts the same way every
 * time. With `forPublish` false, "not approved yet" is left out (the
 * reviewer's view: what blocks approval).
 */
export function publishBlockers(
  version: Pick<VersionWithClaims, 'page' | 'claims' | 'publishBlockers' | 'state' | 'number'>,
  opts: { forPublish?: boolean } = {},
): Blocker[] {
  const forPublish = opts.forPublish ?? true
  const out: Blocker[] = []
  const counts = claimCounts(version.claims)
  if (counts.needs_review > 0) {
    out.push({ id: 'review', kind: 'review', text: claimsNeedReview(counts.needs_review) })
  }
  out.push(...fieldBlockers(version.page, version.claims))
  for (const text of version.publishBlockers ?? []) {
    // Claim counts and approval come from our own wording, so skip the server's copy of them.
    if (reviewPattern.test(text) && /claim/i.test(text)) continue
    if (approvalPattern.test(text) && !forPublish) continue
    if (approvalPattern.test(text) && version.state === 'approved') continue
    if (out.some((b) => b.text.toLowerCase() === text.toLowerCase())) continue
    out.push({ id: `server:${text}`, kind: 'validation', text })
  }
  if (forPublish && version.state !== 'approved' && !out.some((b) => b.kind === 'approval')) {
    const already = out.some((b) => approvalPattern.test(b.text))
    if (!already) {
      out.push({
        id: 'approval',
        kind: 'approval',
        text:
          version.state === 'changes_requested'
            ? `Version ${version.number} was sent back for changes`
            : `Version ${version.number} is not approved yet`,
      })
    }
  }
  return out
}
