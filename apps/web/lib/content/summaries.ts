import type { Block, Page, SiteType } from '@pageforge/blocks'
import { facts } from '@pageforge/content'
import { pathForPage } from '@/lib/paths'

/** Card data for section index pages, derived from each page's own blocks. */
export interface PageSummary {
  title: string
  path: string
  description: string
  siteType?: SiteType
  operator?: string
  heading?: string
  metrics?: { value: string; label: string }[]
  routeFacts?: { label: string; value: string }[]
}

const heroOf = (page: Page) =>
  page.blocks.find((b): b is Extract<Block, { _type: 'hero' }> => b._type === 'hero')

const caseOf = (page: Page) =>
  page.blocks.find((b): b is Extract<Block, { _type: 'caseStudy' }> => b._type === 'caseStudy')

export function summarize(page: Page): PageSummary {
  const hero = heroOf(page)
  const cs = caseOf(page)
  const siteType = cs?.siteType ?? hero?.siteType
  return {
    title: page.title,
    path: pathForPage(page),
    description: hero?.subheading ?? page.seo.description,
    siteType,
    operator: cs?.operator,
    heading: cs?.heading,
    metrics: cs?.metrics,
    routeFacts: siteType ? facts.siteTypes[siteType].routeFacts : undefined,
  }
}

const siteOrder: SiteType[] = ['refinery', 'substation', 'open-pit', 'port', 'solar-farm']

/** Stable order: refinery, substation, open-pit, then anything else by title. */
export function sortBySite(pages: PageSummary[]): PageSummary[] {
  const rank = (s?: SiteType) => (s ? siteOrder.indexOf(s) : siteOrder.length)
  return [...pages].sort(
    (a, b) => rank(a.siteType) - rank(b.siteType) || a.title.localeCompare(b.title),
  )
}
