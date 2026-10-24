import type { Campaign } from '@/lib/abm/types'

/** Public path of a campaign's page, whether or not it is live. */
export function pagePath(c: Pick<Campaign, 'type' | 'slug' | 'token' | 'industry'>): string {
  if (c.type === 'demo') return `/demo/${c.slug}-${c.token ?? ''}`
  if (c.type === 'campaign') return `/campaign/${c.slug}`
  return `/solutions/${c.industry}`
}

/** The path visitors can open now, or null while nothing is published. */
export function livePath(
  c: Pick<Campaign, 'type' | 'slug' | 'token' | 'industry' | 'status' | 'publishedVersionId'>,
): string | null {
  if (!c.publishedVersionId) return null
  if (c.status !== 'published' && c.status !== 'paused') return null
  return pagePath(c)
}
