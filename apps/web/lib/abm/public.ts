// TEMP stub — replaced by feat/abm-backend
import 'server-only'
import type { Page } from '@pageforge/blocks'
import type { CampaignType, CtaConfig, Industry, SeoConfig } from './types'
import { accountNameFor, campaignDetail, serverFixtureDb } from './fixtures'

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

function toPublic(campaignId: string): PublicPage | null {
  const db = serverFixtureDb()
  const c = db.campaigns.find((x) => x.id === campaignId)
  if (!c?.publishedVersionId) return null
  const v = db.versions.find((x) => x.id === c.publishedVersionId)
  if (!v) return null
  const detail = campaignDetail(db, c)
  return {
    campaignId: c.id,
    versionId: v.id,
    page: v.page,
    seo: v.seo,
    cta: v.cta,
    accountName: accountNameFor(db, c),
    type: c.type,
    industry: c.industry,
    canonicalUrl: detail.liveUrl ?? v.seo.canonicalUrl,
  }
}

export async function getAccountPage(
  input: { type: 'demo'; slugToken: string } | { type: 'campaign'; slug: string },
): Promise<PublicPage | { status: 'paused' | 'expired' } | null> {
  const db = serverFixtureDb()
  const c = db.campaigns.find((x) => {
    if (x.type !== input.type) return false
    if (input.type === 'demo') return `${x.slug}-${x.token}` === input.slugToken
    return x.slug === input.slug
  })
  if (!c || !c.publishedVersionId) return null
  if (c.status === 'paused') return { status: 'paused' }
  if (c.status === 'expired' || (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now())) {
    return { status: 'expired' }
  }
  return toPublic(c.id)
}

export async function getSolutionsPage(industry: string): Promise<PublicPage | null> {
  const db = serverFixtureDb()
  const c = db.campaigns.find(
    (x) => x.type === 'solutions' && x.industry === industry && x.status === 'published',
  )
  return c ? toPublic(c.id) : null
}

export async function listPublicSolutionsPaths(): Promise<string[]> {
  const db = serverFixtureDb()
  return db.campaigns
    .filter((x) => x.type === 'solutions' && x.status === 'published' && !x.noindex)
    .map((x) => `/solutions/${x.industry}`)
}
