import type { SiteType } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import type { ProductFact } from './types'

/**
 * Flatten Hoverline's brand facts into id-tagged product facts. Ids are
 * namespaced by group ("stat:", "capability:" …) because group ids overlap
 * (e.g. capability "data-ownership" and faq "data-ownership").
 *
 * With `siteType`, only that site type's site facts are included (all other
 * groups are global), which keeps prompts short.
 */
export function productFactsFrom(facts: BrandFacts, siteType?: SiteType): ProductFact[] {
  const out: ProductFact[] = []
  const sites = (Object.keys(facts.siteTypes) as SiteType[]).filter(
    (s) => !siteType || s === siteType,
  )
  for (const s of sites) {
    const site = facts.siteTypes[s]
    out.push({
      id: `site:${s}:assets`,
      label: `${site.label}: assets inspected`,
      text: site.assets.join('; '),
    })
    out.push({
      id: `site:${s}:findings`,
      label: `${site.label}: typical findings`,
      text: site.typicalFindings.join('; '),
    })
    site.routeFacts.forEach((r, i) =>
      out.push({
        id: `site:${s}:route:${i}`,
        label: `${site.label}: ${r.label}`,
        text: `${r.label}: ${r.value}`,
      }),
    )
  }
  for (const c of facts.capabilities)
    out.push({ id: `capability:${c.id}`, label: c.title, text: `${c.title}. ${c.detail}` })
  for (const s of facts.stats)
    out.push({
      id: `stat:${s.id}`,
      label: `${s.value}${s.unit ?? ''} ${s.label}`,
      text: `${s.value}${s.unit ? ` ${s.unit}` : ''} ${s.label} (${s.basis})`,
    })
  for (const s of facts.specs)
    out.push({ id: `spec:${s.id}`, label: s.label, text: `${s.label}: ${s.value}` })
  for (const o of facts.operators)
    out.push({ id: `operator:${o.id}`, label: o.name, text: `${o.name} (${o.sector})` })
  for (const c of facts.caseStudies)
    out.push({
      id: `case:${c.id}`,
      label: c.heading,
      text: [
        c.operator,
        c.heading,
        c.summary,
        ...c.metrics.map((m) => `${m.value} ${m.label}`),
        c.quote ? `${c.quote.text} ${c.quote.name}, ${c.quote.role}` : '',
      ].join(' '),
    })
  for (const t of facts.testimonials)
    out.push({
      id: `testimonial:${t.id}`,
      label: `${t.name}, ${t.operator}`,
      text: `${t.text} ${t.name}, ${t.role}, ${t.operator}`,
    })
  for (const i of facts.integrations)
    out.push({ id: `integration:${i.id}`, label: i.name, text: `${i.name} (${i.category})` })
  for (const c of facts.compliance)
    out.push({ id: `compliance:${c.id}`, label: c.name, text: `${c.name}. ${c.detail}` })
  for (const f of facts.faqs)
    out.push({ id: `faq:${f.id}`, label: f.question, text: `${f.question} ${f.answer}` })
  out.push({
    id: 'company:one-liner',
    label: `${facts.company.name} in one line`,
    text: `${facts.company.name}: ${facts.company.oneLiner}`,
  })
  return out
}

/** Names that count as "customer names" for the unsourced-statement check. */
export function customerNames(facts: BrandFacts): string[] {
  return facts.operators.map((o) => o.name)
}

/** Certification and approval names from the brand facts. */
export function certificationNames(facts: BrandFacts): string[] {
  return facts.compliance.map((c) => c.name)
}
