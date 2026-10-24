import { registry, type Block, type BlockKind, type Page, type SiteType } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import { blockAvailable } from '../planner'
import { GOAL_CTAS, closingKind } from '../goals'
import { clip, clipSentences, joinList, sentenceCase, slugify } from '../text'
import type { Brief, PagePlan } from '../types'

/**
 * Deterministic copy composer behind FakeLlm. Builds brief-specific pages
 * from the brand facts only, so simulated runs look believable and always
 * pass validation without a network call.
 */

type Facts = BrandFacts

const GOAL_ANGLE: Record<Brief['goal'], string> = {
  'book-demo': 'see a flight over their own site',
  'download-report': 'review a real findings report',
  'contact-sales': 'scope a rollout with an inspection lead',
}

function site(facts: Facts, t: SiteType) {
  return facts.siteTypes[t]
}

function finding(facts: Facts, brief: Brief, i = 0): string {
  const f = site(facts, brief.siteType).typicalFindings
  return f[i % Math.max(1, f.length)] ?? 'early defects'
}

function assets(facts: Facts, brief: Brief, n = 3): string {
  const a = site(facts, brief.siteType).assets.slice(0, n)
  return a.length ? joinList(a) : `${site(facts, brief.siteType).label.toLowerCase()} assets`
}

function audience(brief: Brief): string {
  return joinList(brief.audience.slice(0, 2).map((a) => a.toLowerCase()))
}

/** Short reference to the prospect for headings: drop a leading article. */
function prospectRef(brief: Brief, max = 48): string {
  return clip(brief.prospect.replace(/^(a|an|the)\s+/i, ''), max)
}

/** "refinery operator … refinery inspection" → drop repeated words and fillers for slugs. */
function dedupeWords(s: string): string {
  const seen = new Set<string>()
  const filler = new Set(['a', 'an', 'the', 'on', 'in', 'of', 'with', 'for', 'and'])
  return s
    .split(/\s+/)
    .filter((w) => {
      const k = w.toLowerCase()
      if (filler.has(k) || seen.has(k)) return false
      seen.add(k)
      return true
    })
    .join(' ')
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function pick<T>(items: T[], seed: string): T {
  return items[hash(seed) % items.length]!
}

/** Prefer cited fact ids, then items matching the site type, then the rest. */
function ranked<T extends { id: string }>(
  items: T[],
  cited: string[],
  match?: (t: T) => boolean,
): T[] {
  const score = (t: T) => (cited.includes(t.id) ? 2 : 0) + (match?.(t) ? 1 : 0)
  return [...items].sort((a, b) => score(b) - score(a))
}

export function composePlan(brief: Brief, facts: Facts): PagePlan {
  const closing = closingKind(brief.goal)
  const sector = facts.operators.filter((o) => o.siteType === brief.siteType)
  const notes = (brief.notes ?? '').toLowerCase()
  const roles = brief.audience.join(' ').toLowerCase()

  const want: BlockKind[] = []
  const add = (k: BlockKind, cond = true) => {
    if (cond && !want.includes(k) && blockAvailable(k, facts)) want.push(k)
  }
  add('operatorStrip', /safety|hse|procure|risk/.test(roles) || sector.length >= 2)
  add('statsBand', /cost|downtime|shutdown|safety|budget/.test(notes + roles) || true)
  add('featureGrid')
  add('comparisonTable', /manual|rope|scaffold|crew|helicopter|walk/.test(notes))
  add('howItWorks', /new|first|pilot|trial/.test(notes) || want.length < 4)
  add(
    'caseStudy',
    facts.caseStudies.some((c) => c.siteType === brief.siteType),
  )
  add('integrations', /it|maintenance|asset|planner|sap|maximo/.test(roles + notes))
  add('compliance', brief.siteType !== 'open-pit' || /regulat|compliance|security/.test(notes))
  add('testimonial', want.length < 6)
  add('faq')
  const middle = want.slice(0, 7)

  const sections: PagePlan['sections'] = [
    {
      kind: 'hero',
      purpose: `Name ${finding(facts, brief)} at ${prospectRef(brief, 60)} and the outcome.`,
      factIds: [],
    },
    ...middle.map((kind) => ({
      kind,
      purpose: purposeFor(kind, brief, facts),
      factIds: idsFor(kind, brief, facts),
    })),
    {
      kind: closing,
      purpose: `Ask ${audience(brief)} to ${GOAL_ANGLE[brief.goal]}.`,
      factIds: [],
    },
  ]
  const label = site(facts, brief.siteType).label.toLowerCase()
  return {
    title: clip(sentenceCase(`Drone inspection for ${prospectRef(brief, 60)}`), 90),
    slug: slugify(dedupeWords(`${prospectRef(brief, 40)} ${label} inspection`), 60) || 'landing',
    angle: clip(
      sentenceCase(`${finding(facts, brief)} found on scheduled flights, not after a shutdown`),
      120,
    ),
    sections,
  }
}

function purposeFor(kind: BlockKind, brief: Brief, facts: Facts): string {
  const p: Partial<Record<BlockKind, string>> = {
    operatorStrip: `Show ${site(facts, brief.siteType).label.toLowerCase()} operators already flying.`,
    statsBand: 'Prove the outcome with numbers from deployments.',
    featureGrid: `Show what ${audience(brief)} get from each flight.`,
    comparisonTable: 'Compare docked flights with manual inspection methods.',
    howItWorks: 'Walk through dock install to work order.',
    caseStudy: 'Proof from an operator with the same kind of site.',
    integrations: 'Show findings land in existing maintenance tools.',
    compliance: 'Answer airspace and safety questions up front.',
    testimonial: 'A peer in the same role vouches for the change.',
    faq: 'Handle objections on airspace, data, weather and cost.',
    useCaseTabs: 'Show findings for each asset type.',
  }
  return p[kind] ?? registry[kind].aiUsage.slice(0, 120)
}

function idsFor(kind: BlockKind, brief: Brief, facts: Facts): string[] {
  switch (kind) {
    case 'statsBand':
      return facts.stats.slice(0, 3).map((s) => s.id)
    case 'caseStudy':
      return facts.caseStudies
        .filter((c) => c.siteType === brief.siteType)
        .slice(0, 1)
        .map((c) => c.id)
    case 'operatorStrip':
      return facts.operators.filter((o) => o.siteType === brief.siteType).map((o) => o.id)
    case 'featureGrid':
      return facts.capabilities.slice(0, 4).map((c) => c.id)
    case 'faq':
      return facts.faqs.slice(0, 4).map((f) => f.id)
    default:
      return []
  }
}

export function composePage(brief: Brief, plan: PagePlan, facts: Facts): Page {
  const blocks = plan.sections.map((s, i) =>
    composeBlock(s.kind, `b${i + 1}`, brief, plan, facts, s.factIds),
  )
  const label = site(facts, brief.siteType).label.toLowerCase()
  const seoTitle = fitRange(
    [
      `${prospectRef(brief, 40)}: ${label} drone inspection`,
      `${sentenceCase(label)} drone inspection | ${facts.company.name}`,
    ],
    20,
    60,
  )
  const seoDescription = fitRange(
    [
      `How ${facts.company.name} finds ${finding(facts, brief)} and ${finding(facts, brief, 1)} on scheduled drone flights over ${assets(facts, brief, 2)}, with findings sent to ${audience(brief)}.`,
      `How ${facts.company.name} finds ${finding(facts, brief)} on scheduled drone flights over ${assets(facts, brief, 2)}.`,
      `${facts.company.oneLiner} Built for ${audience(brief)}.`,
    ],
    70,
    160,
  )
  return {
    kind: 'landing',
    title: clip(plan.title, 90),
    slug: plan.slug,
    seo: { title: seoTitle, description: seoDescription, noindex: true },
    blocks,
  }
}

/** First candidate within [min, max]; otherwise clip the first one. */
function fitRange(candidates: string[], min: number, max: number): string {
  for (const c of candidates) {
    const t = c.trim()
    if (t.length >= min && t.length <= max) return t
  }
  for (const c of candidates) {
    const t = clip(c, max)
    if (t.length >= min) return t
  }
  return clip(`${candidates[0]} ${'—'} drone inspection`, max)
}

export function composeBlock(
  kind: BlockKind,
  key: string,
  brief: Brief,
  plan: Pick<PagePlan, 'title' | 'angle'>,
  facts: Facts,
  cited: string[] = [],
): Block {
  const cta = GOAL_CTAS[brief.goal]
  const s = site(facts, brief.siteType)
  const seed = `${brief.prospect}|${kind}`
  switch (kind) {
    case 'hero':
      return {
        _key: key,
        _type: 'hero',
        variant: s.assets.length ? 'route' : 'statement',
        heading: clip(
          sentenceCase(
            pick(
              [
                `Find ${finding(facts, brief)} before it takes a unit offline`,
                `Catch ${finding(facts, brief)} on a flight, not in a shutdown`,
                `Scheduled drone flights for ${finding(facts, brief)} at ${prospectRef(brief, 40)}`,
              ],
              seed,
            ),
          ),
          90,
        ),
        subheading: clipSentences(
          `${facts.company.name} flies a docked drone over your ${assets(facts, brief)} on a fixed schedule. ${sentenceCase(audience(brief))} get each finding with photos and position, ready to plan the repair.`,
          260,
        ),
        primaryCta: { label: clip(cta.label, 32), href: cta.href },
        secondaryCta: { label: 'See how a flight works', href: '#how-it-works' },
        siteType: brief.siteType,
      }
    case 'operatorStrip': {
      const ops = ranked(facts.operators, cited, (o) => o.siteType === brief.siteType).slice(0, 6)
      return {
        _key: key,
        _type: 'operatorStrip',
        heading: clip(`Flying today at ${s.label.toLowerCase()} sites and beyond`, 80),
        operators: ops.map((o) => ({ name: clip(o.name, 40), sector: clip(o.sector, 40) })),
      }
    }
    case 'statsBand': {
      const stats = ranked(facts.stats, cited)
        .filter((x) => x.value.length <= 12 && (x.unit ?? '').length <= 12)
        .slice(0, 3)
      return {
        _key: key,
        _type: 'statsBand',
        heading: clip(
          `What changes when ${s.label.toLowerCase()} inspections fly on a schedule`,
          80,
        ),
        stats: stats.map((x) => ({
          value: x.value,
          ...(x.unit ? { unit: x.unit } : {}),
          label: clip(x.label, 90),
          basis: clip(x.basis, 120),
        })),
      }
    }
    case 'featureGrid': {
      const caps = ranked(facts.capabilities, cited).slice(0, 4)
      return {
        _key: key,
        _type: 'featureGrid',
        heading: clip(sentenceCase(`What ${audience(brief)} get from every flight`), 90),
        intro: clipSentences(
          `Each route covers your ${assets(facts, brief)}, so ${finding(facts, brief)} shows up while it is still a planned repair.`,
          280,
        ),
        features: caps.map((c) => ({
          title: clip(c.title, 60),
          body: clipSentences(c.detail, 240),
        })),
      }
    }
    case 'useCaseTabs': {
      const sites = (Object.keys(facts.siteTypes) as SiteType[])
        .filter((t) => facts.siteTypes[t].typicalFindings.length >= 2)
        .sort((a, b) => (a === brief.siteType ? -1 : b === brief.siteType ? 1 : 0))
        .slice(0, 4)
      return {
        _key: key,
        _type: 'useCaseTabs',
        heading: 'What a flight finds at each kind of site',
        tabs: sites.map((t) => {
          const x = facts.siteTypes[t]
          return {
            label: clip(x.label, 28),
            siteType: t,
            heading: clip(
              sentenceCase(`${x.label} routes cover ${joinList(x.assets.slice(0, 2))}`),
              90,
            ),
            body: clipSentences(
              `The drone flies the same path each time, so changes on ${joinList(x.assets.slice(0, 3))} are easy to compare.`,
              320,
            ),
            findings: x.typicalFindings.slice(0, 5).map((f) => clip(sentenceCase(f), 80)),
          }
        }),
      }
    }
    case 'howItWorks': {
      const route = s.routeFacts.map((r) => `${r.label.toLowerCase()} ${r.value}`)
      return {
        _key: key,
        _type: 'howItWorks',
        heading: 'From dock install to work order',
        steps: [
          {
            title: 'Install the dock',
            body: clipSentences(
              `We install a weatherproof dock on site. The drone launches, lands and charges there.`,
              220,
            ),
          },
          {
            title: 'Plan the route',
            body: clipSentences(
              `Your team and ours map a route over ${assets(facts, brief)}${route.length ? ` (${joinList(route)})` : ''}.`,
              220,
            ),
          },
          {
            title: 'Fly on a schedule',
            body: clipSentences(
              `Flights run on the schedule you set, with a remote pilot supervising.`,
              220,
            ),
          },
          {
            title: 'Act on findings',
            body: clipSentences(
              `Findings such as ${finding(facts, brief)} arrive with photos and position, ready to become work orders.`,
              220,
            ),
          },
        ],
      }
    }
    case 'caseStudy': {
      const cs =
        ranked(facts.caseStudies, cited, (c) => c.siteType === brief.siteType).find(
          (c) => c.metrics.length >= 2,
        ) ?? facts.caseStudies[0]!
      const quote =
        cs.quote &&
        cs.quote.text.length <= 280 &&
        cs.quote.name.length <= 50 &&
        cs.quote.role.length <= 70
          ? { text: cs.quote.text, name: cs.quote.name, role: cs.quote.role }
          : undefined
      return {
        _key: key,
        _type: 'caseStudy',
        operator: clip(cs.operator, 60),
        siteType: cs.siteType,
        heading: clip(cs.heading, 110),
        summary: clipSentences(cs.summary, 420),
        metrics: cs.metrics
          .filter((m) => m.value.length <= 12)
          .slice(0, 3)
          .map((m) => ({ value: m.value, label: clip(m.label, 70) })),
        ...(quote ? { quote } : {}),
        slug: cs.slug.slice(0, 80),
      }
    }
    case 'testimonial': {
      const roles = brief.audience.join(' ').toLowerCase()
      const t =
        ranked(facts.testimonials, cited, (x) =>
          roles.includes(x.role.toLowerCase().split(' ')[0] ?? ''),
        ).find(
          (x) =>
            x.text.length <= 320 &&
            x.name.length <= 50 &&
            x.role.length <= 70 &&
            x.operator.length <= 60,
        ) ?? facts.testimonials[0]!
      return {
        _key: key,
        _type: 'testimonial',
        text: t.text,
        name: t.name,
        role: t.role,
        operator: t.operator,
      }
    }
    case 'comparisonTable': {
      const rows = [
        ...facts.capabilities.map((c) => ({
          label: clip(c.title, 70),
          values: [true, false, false] as (boolean | string)[],
        })),
      ].slice(0, 6)
      for (const sp of facts.specs) {
        if (rows.length >= 3) break
        rows.push({ label: clip(sp.label, 70), values: [clip(sp.value, 40), false, false] })
      }
      return {
        _key: key,
        _type: 'comparisonTable',
        heading: 'Docked flights compared with manual rounds',
        intro: clipSentences(
          `How a scheduled drone route compares with walk-downs and rope access on ${assets(facts, brief, 2)}.`,
          240,
        ),
        columns: [clip(facts.company.name, 32), 'Manual rounds', 'Rope access'],
        rows,
      }
    }
    case 'integrations':
      return {
        _key: key,
        _type: 'integrations',
        heading: 'Findings go where your planners already work',
        intro: clipSentences(
          'Confirmed findings become work orders in the tools your maintenance team uses today.',
          240,
        ),
        items: facts.integrations
          .slice(0, 16)
          .map((x) => ({ name: clip(x.name, 40), category: clip(x.category, 40) })),
      }
    case 'compliance':
      return {
        _key: key,
        _type: 'compliance',
        heading: clip(`Approvals and safety for ${s.label.toLowerCase()} sites`, 90),
        items: ranked(facts.compliance, cited)
          .filter((c) => c.name.length <= 40)
          .slice(0, 6)
          .map((c) => ({ name: c.name, detail: clipSentences(c.detail, 160) })),
      }
    case 'faq':
      return {
        _key: key,
        _type: 'faq',
        heading: sentenceCase(clip(`Questions ${audience(brief)} ask first`, 90)),
        items: ranked(facts.faqs, cited)
          .slice(0, 6)
          .map((f) => ({ question: clip(f.question, 140), answer: clipSentences(f.answer, 600) })),
      }
    case 'ctaBand':
      return {
        _key: key,
        _type: 'ctaBand',
        heading: clip(
          sentenceCase(
            brief.goal === 'download-report'
              ? `See what a ${s.label.toLowerCase()} findings report looks like`
              : `Plan a first route over your ${assets(facts, brief, 2)}`,
          ),
          90,
        ),
        body: clipSentences(
          brief.goal === 'download-report'
            ? `The sample report shows how ${finding(facts, brief)} is logged, located and tracked between flights.`
            : `An inspection lead will review your site layout and propose a route and schedule.`,
          240,
        ),
        cta: { label: clip(cta.label, 32), href: cta.href },
      }
    case 'demoForm':
      return {
        _key: key,
        _type: 'demoForm',
        heading: clip(sentenceCase(`Book a demo flight for ${prospectRef(brief, 50)}`), 90),
        body: clipSentences(
          `Tell us about your site. We will show a recorded flight over a ${s.label.toLowerCase()} like yours and the findings it produced.`,
          280,
        ),
        submitLabel: 'Request a demo flight',
        nextSteps: [
          'An inspection lead replies within one working day.',
          `We review your ${assets(facts, brief, 2)} and propose a route.`,
          'You see a recorded flight and a sample findings report.',
        ].map((x) => clip(x, 120)),
      }
  }
}
