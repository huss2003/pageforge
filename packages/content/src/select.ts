import type { BlockProps, SiteType } from '@pageforge/blocks'
import { facts } from './facts'
import type { BrandFacts } from './types'

/**
 * Typed selectors that turn fact ids into block content.
 *
 * Seed pages build every claim through these helpers instead of retyping
 * copy, so a number or quote can only appear on a page if it exists in
 * `facts`. A missing id throws at import time, which fails tests and builds.
 */

function byId<T extends { id: string }>(list: T[], id: string, what: string): T {
  const item = list.find((x) => x.id === id)
  if (!item) throw new Error(`Unknown ${what} id "${id}" in brand facts`)
  return item
}

type Stat = BlockProps<'statsBand'>['stats'][number]
type Operator = BlockProps<'operatorStrip'>['operators'][number]
type Feature = BlockProps<'featureGrid'>['features'][number]
type FaqItem = BlockProps<'faq'>['items'][number]
type Integration = BlockProps<'integrations'>['items'][number]
type ComplianceItem = BlockProps<'compliance'>['items'][number]

export function stats(...ids: string[]): Stat[] {
  return ids.map((id) => {
    const s = byId(facts.stats, id, 'stat')
    return { value: s.value, ...(s.unit ? { unit: s.unit } : {}), label: s.label, basis: s.basis }
  })
}

export function operators(...ids: string[]): Operator[] {
  return ids.map((id) => {
    const o = byId(facts.operators, id, 'operator')
    return { name: o.name, sector: o.sector }
  })
}

export function operatorsFor(siteType: SiteType): Operator[] {
  return facts.operators
    .filter((o) => o.siteType === siteType)
    .map((o) => ({ name: o.name, sector: o.sector }))
}

export function allOperators(): Operator[] {
  return facts.operators.map((o) => ({ name: o.name, sector: o.sector }))
}

export function features(...ids: string[]): Feature[] {
  return ids.map((id) => {
    const c = byId(facts.capabilities, id, 'capability')
    return { title: c.title, body: c.detail }
  })
}

export function faqs(...ids: string[]): FaqItem[] {
  return ids.map((id) => {
    const f = byId(facts.faqs, id, 'faq')
    return { question: f.question, answer: f.answer }
  })
}

export function integrations(...ids: string[]): Integration[] {
  const list = ids.length
    ? ids.map((id) => byId(facts.integrations, id, 'integration'))
    : facts.integrations
  return list.map((i) => ({ name: i.name, category: i.category }))
}

export function compliance(...ids: string[]): ComplianceItem[] {
  const list = ids.length
    ? ids.map((id) => byId(facts.compliance, id, 'compliance'))
    : facts.compliance
  return list.map((c) => ({ name: c.name, detail: c.detail }))
}

export function caseStudy(
  id: string,
  opts: { key: string; link?: boolean },
): BlockProps<'caseStudy'> {
  const c = byId(facts.caseStudies, id, 'case study')
  return {
    _key: opts.key,
    _type: 'caseStudy',
    operator: c.operator,
    siteType: c.siteType,
    heading: c.heading,
    summary: c.summary,
    metrics: c.metrics,
    ...(c.quote ? { quote: c.quote } : {}),
    ...(opts.link === false ? {} : { slug: c.slug }),
  }
}

export function testimonial(id: string, key: string): BlockProps<'testimonial'> {
  const t = byId(facts.testimonials, id, 'testimonial')
  return {
    _key: key,
    _type: 'testimonial',
    text: t.text,
    name: t.name,
    role: t.role,
    operator: t.operator,
  }
}

export function caseStudyFact(id: string): BrandFacts['caseStudies'][number] {
  return byId(facts.caseStudies, id, 'case study')
}

/** Findings for a use-case tab, straight from the site type facts. */
export function findings(siteType: SiteType, count = 4): string[] {
  return facts.siteTypes[siteType].typicalFindings.slice(0, count)
}
