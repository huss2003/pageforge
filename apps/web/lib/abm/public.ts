import 'server-only'
import type { Page } from '@pageforge/blocks'
import { getAbmConfig } from './config'
import { TOKEN_PATTERN, safeEqual } from './crypto'
import { absolute, publicPath } from './paths'
import { getAbmRuntime } from './runtime'
import { expireIfDue } from './service'
import type { Campaign, CampaignType, CtaConfig, Industry, SeoConfig } from './types'

/**
 * Read API for the public account routes (/demo, /campaign, /solutions).
 * Only published versions are ever returned. A wrong token, an unknown
 * slug or an unpublished campaign all return null (404, no oracle).
 */
export type PublicPage = {
  campaignId: string
  versionId: string
  page: Page
  seo: SeoConfig
  cta: CtaConfig
  accountName: string | null
  type: CampaignType
  industry: Industry
  canonicalUrl: string
}

const INDUSTRIES: Industry[] = ['ports', 'refineries', 'power-grids', 'open-pit-mining', 'solar']

/** Prefer the main workspace when the same path exists in both. */
const byWorkspace = (a: Campaign, b: Campaign) =>
  a.workspace === b.workspace ? 0 : a.workspace === 'main' ? -1 : 1

async function toPublic(
  c: Campaign,
): Promise<PublicPage | { status: 'paused' | 'expired' } | null> {
  const campaign = await expireIfDue(c)
  if (campaign.status === 'paused') return { status: 'paused' }
  if (campaign.status === 'expired')
    return campaign.publishedVersionId ? { status: 'expired' } : null
  if (campaign.status !== 'published' || !campaign.publishedVersionId) return null
  const { store } = getAbmRuntime()
  const version = await store.getVersion(campaign.publishedVersionId)
  if (!version) return null
  const account = campaign.accountId ? await store.getAccount(campaign.accountId) : null
  const path = publicPath(campaign)
  if (!path) return null
  return {
    campaignId: campaign.id,
    versionId: version.id,
    page: version.page,
    seo: version.seo,
    cta: version.cta,
    accountName: account?.name ?? null,
    type: campaign.type,
    industry: campaign.industry,
    canonicalUrl: absolute(getAbmConfig().siteUrl, path),
  }
}

/** Split "northstar-port-authority-k3x9…" into slug and 12-char token. */
export function parseSlugToken(slugToken: string): { slug: string; token: string } | null {
  const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)-([a-z2-9]{12})$/.exec(slugToken)
  if (!m || !TOKEN_PATTERN.test(m[2]!)) return null
  return { slug: m[1]!, token: m[2]! }
}

export async function getAccountPage(
  input: { type: 'demo'; slugToken: string } | { type: 'campaign'; slug: string },
): Promise<PublicPage | { status: 'paused' | 'expired' } | null> {
  const { store } = getAbmRuntime()
  if (input.type === 'demo') {
    const parsed = parseSlugToken(input.slugToken)
    if (!parsed) return null
    const candidates = await store.findCampaigns({ type: 'demo', slug: parsed.slug })
    // Compare every candidate in constant time; never short-circuit on a prefix.
    let match: Campaign | null = null
    for (const c of candidates.sort(byWorkspace)) {
      if (c.status === 'archived' || !c.token) continue
      if (safeEqual(c.token, parsed.token) && !match) match = c
    }
    return match ? toPublic(match) : null
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) return null
  const candidates = (await store.findCampaigns({ type: 'campaign', slug: input.slug }))
    .filter((c) => c.status !== 'archived' && c.publishedVersionId)
    .sort(byWorkspace)
  return candidates[0] ? toPublic(candidates[0]) : null
}

/** Published solutions campaign for an industry, else null (the UI falls back to the static page). */
export async function getSolutionsPage(industry: string): Promise<PublicPage | null> {
  if (!INDUSTRIES.includes(industry as Industry)) return null
  const { store } = getAbmRuntime()
  const candidates = (
    await store.findCampaigns({ type: 'solutions', slug: industry, status: ['published'] })
  ).sort(byWorkspace)
  for (const c of candidates) {
    const page = await toPublic(c)
    if (page && 'page' in page) return page
  }
  return null
}

/** Paths of published solutions pages, e.g. ["/solutions/ports"]. */
export async function listPublicSolutionsPaths(): Promise<string[]> {
  const { store } = getAbmRuntime()
  const published = await store.findCampaigns({ type: 'solutions', status: ['published'] })
  return [
    ...new Set(published.filter((c) => !c.noindex).map((c) => `/solutions/${c.industry}`)),
  ].sort()
}
