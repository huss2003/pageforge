import type { SiteType } from '@pageforge/blocks'

/**
 * Brand facts: the ONLY source of claims the writer agent may use.
 * Every number, customer, certification and integration on a generated
 * page must trace back to an entry here (checked by the validator via ids).
 */
export interface BrandFacts {
  company: {
    name: string
    oneLiner: string
    /** Shown on every page: Hoverline is fictional. */
    disclosure: string
  }
  siteTypes: Record<
    SiteType,
    {
      label: string
      /** Assets the drone inspects at this kind of site. */
      assets: string[]
      typicalFindings: string[]
      /** Typical route length, flight time etc. used by the route planner. */
      routeFacts: { label: string; value: string }[]
    }
  >
  capabilities: { id: string; title: string; detail: string }[]
  specs: { id: string; label: string; value: string }[]
  stats: { id: string; value: string; unit?: string; label: string; basis: string }[]
  operators: { id: string; name: string; sector: string; siteType: SiteType }[]
  caseStudies: {
    id: string
    slug: string
    operator: string
    siteType: SiteType
    heading: string
    summary: string
    metrics: { value: string; label: string }[]
    quote?: { text: string; name: string; role: string }
  }[]
  testimonials: { id: string; text: string; name: string; role: string; operator: string }[]
  integrations: { id: string; name: string; category: string }[]
  compliance: { id: string; name: string; detail: string }[]
  faqs: { id: string; question: string; answer: string; tags: string[] }[]
  voice: {
    /** Style rules the writer follows. */
    do: string[]
    dont: string[]
    /** Words and phrases that must never appear in copy. */
    bannedPhrases: string[]
  }
}
