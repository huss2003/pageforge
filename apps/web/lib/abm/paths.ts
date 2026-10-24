import type { Campaign, Industry, TrackingLink } from './types'

/**
 * Public paths for ABM pages (spec §3):
 *   demo      /demo/{slug}-{token}   private, noindex, not in the sitemap
 *   campaign  /campaign/{slug}       public link, noindex by default
 *   solutions /solutions/{industry}  public, indexable generic baseline
 */
export function publicPath(
  c: Pick<Campaign, 'type' | 'slug' | 'token' | 'industry'>,
): string | null {
  if (c.type === 'demo') return c.token ? `/demo/${c.slug}-${c.token}` : null
  if (c.type === 'campaign') return `/campaign/${c.slug}`
  return `/solutions/${c.industry}`
}

export function absolute(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/$/, '')}${path}`
}

export function slugify(text: string, max = 60): string {
  const s = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
  if (s.length <= max) return s.replace(/^-+|-+$/g, '') || 'account'
  const cut = s.slice(0, max)
  const dash = cut.lastIndexOf('-')
  return (dash > 10 ? cut.slice(0, dash) : cut).replace(/^-+|-+$/g, '') || 'account'
}

export const INDUSTRY_LABEL: Record<Industry, { label: string; audience: string }> = {
  ports: { label: 'Ports', audience: 'port operators' },
  refineries: { label: 'Refineries', audience: 'refinery operators' },
  'power-grids': { label: 'Power grids', audience: 'grid operators' },
  'open-pit-mining': { label: 'Open-pit mining', audience: 'mine operators' },
  solar: { label: 'Solar', audience: 'solar farm operators' },
}

const MEDIUM: Record<TrackingLink['channel'], string> = {
  email: 'email',
  linkedin: 'social',
  'sales-sequence': 'outbound',
  event: 'event',
  paid: 'cpc',
  other: 'referral',
}

/** UTM-tagged links per channel: email, LinkedIn and sales sequence, plus the brief's own channel. */
export function trackingLinks(
  liveUrl: string,
  c: Pick<Campaign, 'utmCampaign' | 'slug' | 'sourceChannel'>,
): TrackingLink[] {
  const channels: TrackingLink['channel'][] = ['email', 'linkedin', 'sales-sequence']
  const own = c.sourceChannel as TrackingLink['channel'] | null
  if (own && own in MEDIUM && !channels.includes(own)) channels.push(own)
  return channels.map((channel) => {
    const u = new URL(liveUrl)
    u.searchParams.set('utm_source', channel)
    u.searchParams.set('utm_medium', MEDIUM[channel])
    u.searchParams.set('utm_campaign', c.utmCampaign)
    u.searchParams.set('utm_content', c.slug)
    return { channel, url: u.href }
  })
}
