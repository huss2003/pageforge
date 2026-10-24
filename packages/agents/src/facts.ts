import type { BlockKind, SiteType } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'

/**
 * Compact, id-tagged serialisation of the brand facts for prompts.
 * One line per fact keeps token use low and lets the planner cite ids.
 */

/** Every fact id in the facts file, for checking planner output. */
export function factIds(facts: BrandFacts): Set<string> {
  return new Set(
    [
      ...facts.capabilities,
      ...facts.specs,
      ...facts.stats,
      ...facts.operators,
      ...facts.caseStudies,
      ...facts.testimonials,
      ...facts.integrations,
      ...facts.compliance,
      ...facts.faqs,
    ].map((f) => f.id),
  )
}

export function statText(s: { value: string; unit?: string }): string {
  return `${s.value}${s.unit ?? ''}`
}

/** Index for the planner: ids with one short label each. */
export function factIndex(facts: BrandFacts, siteType: SiteType): string {
  const site = facts.siteTypes[siteType]
  const lines: string[] = [
    `company: ${facts.company.name} — ${facts.company.oneLiner}`,
    `site ${siteType}: assets ${site.assets.join(', ') || '-'}; findings ${site.typicalFindings.join(', ') || '-'}`,
  ]
  const other = (Object.keys(facts.siteTypes) as SiteType[]).filter((k) => k !== siteType)
  if (other.length)
    lines.push(`other sites: ${other.map((k) => facts.siteTypes[k].label).join(', ')}`)
  section(lines, 'capabilities', facts.capabilities, (c) => `${c.id}: ${c.title}`)
  section(lines, 'stats', facts.stats, (s) => `${s.id}: ${statText(s)} ${s.label}`)
  section(
    lines,
    'operators',
    facts.operators,
    (o) => `${o.id}: ${o.name} (${o.sector}, ${o.siteType})`,
  )
  section(
    lines,
    'caseStudies',
    facts.caseStudies,
    (c) => `${c.id}: ${c.operator} (${c.siteType}) — ${c.heading}`,
  )
  section(
    lines,
    'testimonials',
    facts.testimonials,
    (t) => `${t.id}: ${t.name}, ${t.role}, ${t.operator}`,
  )
  section(lines, 'integrations', facts.integrations, (i) => `${i.id}: ${i.name} (${i.category})`)
  section(lines, 'compliance', facts.compliance, (c) => `${c.id}: ${c.name}`)
  section(lines, 'faqs', facts.faqs, (f) => `${f.id}: ${f.question}`)
  return lines.join('\n')
}

/** Which fact groups each block needs in full when writing. */
const NEEDS: Partial<Record<BlockKind, (keyof BrandFacts)[]>> = {
  operatorStrip: ['operators'],
  statsBand: ['stats'],
  featureGrid: ['capabilities'],
  howItWorks: ['capabilities', 'specs'],
  caseStudy: ['caseStudies'],
  testimonial: ['testimonials'],
  comparisonTable: ['capabilities', 'specs'],
  integrations: ['integrations'],
  compliance: ['compliance'],
  faq: ['faqs'],
}

/**
 * Full detail for the writer, limited to the groups the planned blocks need
 * plus any fact the plan cites by id.
 */
export function factDetail(
  facts: BrandFacts,
  opts: { siteType: SiteType; kinds: BlockKind[]; cited: string[] },
): string {
  const groups = new Set<keyof BrandFacts>()
  for (const k of opts.kinds) for (const g of NEEDS[k] ?? []) groups.add(g)
  const cited = new Set(opts.cited)
  const want = <T extends { id: string }>(group: keyof BrandFacts, items: T[]) =>
    groups.has(group) ? items : items.filter((i) => cited.has(i.id))

  const lines: string[] = [`company: ${facts.company.name} — ${facts.company.oneLiner}`]
  const sites = opts.kinds.includes('useCaseTabs')
    ? (Object.keys(facts.siteTypes) as SiteType[])
    : [opts.siteType]
  for (const k of sites) {
    const s = facts.siteTypes[k]
    lines.push(
      `site ${k} (${s.label}): assets ${s.assets.join(', ')}; findings ${s.typicalFindings.join(', ')}` +
        (s.routeFacts.length
          ? `; ${s.routeFacts.map((r) => `${r.label} ${r.value}`).join(', ')}`
          : ''),
    )
  }
  section(
    lines,
    'capabilities',
    want('capabilities', facts.capabilities),
    (c) => `${c.id}: ${c.title} — ${c.detail}`,
  )
  section(lines, 'specs', want('specs', facts.specs), (s) => `${s.id}: ${s.label} ${s.value}`)
  section(
    lines,
    'stats (value|unit|label|basis)',
    want('stats', facts.stats),
    (s) => `${s.id}: ${s.value}|${s.unit ?? ''}|${s.label}|${s.basis}`,
  )
  section(
    lines,
    'operators',
    want('operators', facts.operators),
    (o) => `${o.id}: ${o.name} | ${o.sector}`,
  )
  section(lines, 'caseStudies', want('caseStudies', facts.caseStudies), (c) =>
    [
      `${c.id}: operator ${c.operator}; siteType ${c.siteType}; slug ${c.slug}`,
      `  heading: ${c.heading}`,
      `  summary: ${c.summary}`,
      `  metrics: ${c.metrics.map((m) => `${m.value} = ${m.label}`).join('; ')}`,
      c.quote ? `  quote: "${c.quote.text}" — ${c.quote.name}, ${c.quote.role}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  section(
    lines,
    'testimonials',
    want('testimonials', facts.testimonials),
    (t) => `${t.id}: "${t.text}" — ${t.name} | ${t.role} | ${t.operator}`,
  )
  section(
    lines,
    'integrations',
    want('integrations', facts.integrations),
    (i) => `${i.id}: ${i.name} | ${i.category}`,
  )
  section(
    lines,
    'compliance',
    want('compliance', facts.compliance),
    (c) => `${c.id}: ${c.name} | ${c.detail}`,
  )
  section(lines, 'faqs', want('faqs', facts.faqs), (f) => `${f.id}: Q ${f.question} A ${f.answer}`)
  return lines.join('\n')
}

function section<T>(lines: string[], title: string, items: T[], fmt: (t: T) => string) {
  if (!items.length) return
  lines.push(`${title}:`)
  for (const i of items) lines.push(`- ${fmt(i)}`)
}
