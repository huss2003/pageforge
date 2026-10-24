import type { Block } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import { GOAL_CLOSING, type DraftOutput } from './draft'
import { splitSentences } from './text'
import { INDUSTRY_SITE_TYPE, type AbmBrief, type AbmIndustry, type FactCategory } from './types'
import type { SelectFactsOutput } from './select'

/**
 * Offline answers for the ABM tasks, used by FakeLlm in simulation mode and
 * in tests. Deterministic, composed only from the brand facts and the
 * account facts in the prompt, so validation behaves as with a real model.
 *
 * The draft ALWAYS includes exactly one unsupported claim ("cut security
 * staffing costs by 40%") so the demo shows a reviewer rejecting a claim.
 */
export const UNSUPPORTED_CLAIM_PHRASE = 'cut security staffing costs by 40%'

interface Profile {
  heading: (name: string) => string
  capabilities: string[]
  stats: string[]
  faqs: string[]
  steps: string[]
}

const PROFILES: Record<AbmIndustry, Profile> = {
  ports: {
    heading: (n) => `Scheduled drone patrols for ${n}`,
    capabilities: ['perimeter-patrol', 'after-hours-berths', 'security-handoff', 'zoom'],
    stats: ['patrol-coverage', 'night-patrols', 'response-time', 'flight-completion'],
    faqs: ['port-security-role', 'night-flights', 'airspace', 'data-ownership'],
    steps: ['dock', 'perimeter-patrol', 'security-handoff', 'change-detection'],
  },
  solar: {
    heading: (n) => `String-level thermal flights for ${n}`,
    capabilities: ['string-thermal', 'soiling-vegetation', 'thermal', 'work-orders'],
    stats: ['solar-survey-rate', 'solar-faults-found', 'flight-completion', 'detection-lead'],
    faqs: ['weather', 'data-ownership', 'cmms', 'airspace'],
    steps: ['dock', 'string-thermal', 'review-queue', 'work-orders'],
  },
  refineries: {
    heading: (n) => `Scheduled inspection flights for ${n}`,
    capabilities: ['thermal', 'zoom', 'change-detection', 'work-orders'],
    stats: ['inspection-hours', 'detection-lead', 'permits-avoided', 'flight-completion'],
    faqs: ['hazardous-areas', 'airspace', 'cmms', 'weather'],
    steps: ['dock', 'scheduled-routes', 'review-queue', 'work-orders'],
  },
  'power-grids': {
    heading: (n) => `Daily substation flights for ${n}`,
    capabilities: ['thermal', 'zoom', 'on-demand', 'work-orders'],
    stats: ['detection-lead', 'response-time', 'permits-avoided', 'flight-completion'],
    faqs: ['substation-clearance', 'airspace', 'security', 'cmms'],
    steps: ['dock', 'scheduled-routes', 'review-queue', 'work-orders'],
  },
  'open-pit-mining': {
    heading: (n) => `Pre-shift pit surveys for ${n}`,
    capabilities: ['lidar', 'change-detection', 'scheduled-routes', 'work-orders'],
    stats: ['slope-resolution', 'inspection-hours', 'flight-completion', 'response-time'],
    faqs: ['slope-monitoring', 'weather', 'airspace', 'pricing'],
    steps: ['dock', 'lidar', 'review-queue', 'work-orders'],
  },
}

/** Short Hoverline lines (each supported by its capability fact) to pair with an account quote. */
const SHORT: Record<string, string> = {
  'perimeter-patrol':
    'A dock-based drone flies the fence line and gates on a fixed schedule, day and night.',
  'after-hours-berths':
    'Night flights use thermal imaging, so people and open container doors show up without floodlights.',
  'security-handoff':
    'Findings reach your control room with a thermal clip; your officers decide what happens next.',
  zoom: 'The zoom camera reads nameplates and gauges from outside the exclusion zone.',
  'string-thermal': 'Thermal flights map cold strings and hot cells to their row and tracker.',
  'soiling-vegetation': 'Visual surveys map soiling and vegetation shading row by row.',
  thermal: 'A radiometric thermal camera flags anything above the threshold you set.',
  'work-orders': 'Confirmed findings become work orders in your maintenance system.',
  'change-detection': 'Each flight is compared with the last, so only changes reach your team.',
  'on-demand': 'The control room can send the drone to an alarm location in a few clicks.',
  lidar: 'Repeat LiDAR surveys measure wall movement without a survey crew on the bench.',
  'scheduled-routes': 'Same route and camera angles every flight, so images compare like for like.',
}

const clip = (t: string, max: number) => {
  const s = t.trim().replace(/\s+/g, ' ')
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s,;:–—-]+$/, '')
}

/** Whole sentences up to `max` characters (at least the first, clipped). */
const sentencesUpTo = (t: string, max: number) => {
  let out = ''
  for (const s of splitSentences(t)) {
    if ((out ? `${out} ${s}` : s).length > max) break
    out = out ? `${out} ${s}` : s
  }
  return out || clip(t, max)
}

function byId<T extends { id: string }>(list: T[], id: string): T {
  const x = list.find((i) => i.id === id)
  if (!x) throw new Error(`simulate: unknown fact id ${id}`)
  return x
}

export interface SimAccountFact {
  ref: string
  quote: string
  category: FactCategory
}

type Claim = DraftOutput['claims'][number]

export function simulateDraft(
  brief: AbmBrief,
  accountFacts: SimAccountFact[],
  facts: BrandFacts,
): DraftOutput {
  const name = brief.companyName.trim()
  const profile = PROFILES[brief.industry]
  const siteType = INDUSTRY_SITE_TYPE[brief.industry]
  const goal = GOAL_CLOSING[brief.goal]
  const claims: Claim[] = []
  const claim = (
    blockKey: string,
    field: string,
    text: string,
    kind: Claim['kind'],
    productFactIds: string[] = [],
    accountFactIds: string[] = [],
  ) => claims.push({ blockKey, field, text, kind, productFactIds, accountFactIds })

  const cap = (id: string) => byId(facts.capabilities, id)
  const lead = cap(profile.capabilities[0]!)

  // b1 hero
  const subheading = sentencesUpTo(lead.detail, 260)
  const hero: Block = {
    _key: 'b1',
    _type: 'hero',
    variant: 'route',
    heading: clip(profile.heading(name), 90),
    subheading,
    primaryCta: { label: goal.label, href: goal.href },
    siteType,
  }
  claim('b1', 'heading', hero.heading, 'positioning')
  claim('b1', 'subheading', subheading, 'product_fact', [`capability:${lead.id}`])

  // b2 feature grid: account facts paired with capabilities, plus the one unsupported claim.
  const ordered = [...accountFacts].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) || Number(a.ref.slice(1)) - Number(b.ref.slice(1)),
  )
  const introLead = accountFacts.length
    ? `Each point below starts from something ${name} has published.`
    : `What a Hoverline dock would do at a site like yours.`
  const unsupported = `Sites that move patrols to scheduled drone flights ${UNSUPPORTED_CLAIM_PHRASE}.`
  const features = profile.capabilities.slice(0, 4).map((id, i) => {
    const c = cap(id)
    const fact = ordered[i]
    const capSentence = SHORT[id] ?? splitSentences(c.detail)[0] ?? c.detail
    const field = `features[${i}].body`
    let body: string
    if (fact && fact.quote.length + capSentence.length + 3 <= 240) {
      body = `“${fact.quote}” ${capSentence}`
      claim('b2', field, fact.quote, 'account_fact', [], [fact.ref])
      claim('b2', field, capSentence, 'product_fact', [`capability:${id}`])
    } else if (fact && fact.quote.length + 2 <= 240) {
      body = `“${fact.quote}”`
      claim('b2', field, fact.quote, 'account_fact', [], [fact.ref])
    } else {
      body = sentencesUpTo(c.detail, 240)
      claim('b2', field, body, 'product_fact', [`capability:${id}`])
    }
    return { title: clip(c.title, 60), body }
  })
  const grid: Block = {
    _key: 'b2',
    _type: 'featureGrid',
    heading: clip(`Where drones fit for ${name}`, 90),
    intro: clip(`${introLead} ${unsupported}`, 280),
    features,
  }
  claim('b2', 'intro', introLead, 'positioning')
  // Cites a real capability, but the 40% figure is in no fact: the validator flags it.
  claim('b2', 'intro', unsupported, 'product_fact', ['capability:perimeter-patrol'])

  // b3 stats band, copied from brand-fact stats.
  const stats = profile.stats.map((id, i) => {
    const s = byId(facts.stats, id)
    claim(
      'b3',
      `stats[${i}]`,
      `${s.value}${s.unit ? (s.unit === '%' ? '%' : ` ${s.unit}`) : ''} ${s.label} (${s.basis})`,
      'product_fact',
      [`stat:${s.id}`],
    )
    return { value: s.value, ...(s.unit ? { unit: s.unit } : {}), label: s.label, basis: s.basis }
  })
  const band: Block = {
    _key: 'b3',
    _type: 'statsBand',
    heading: 'What a Hoverline dock does today',
    stats,
  }
  claim('b3', 'heading', band.heading!, 'positioning')

  // b4 how it works.
  const steps = profile.steps.map((id, i) => {
    const c = cap(id)
    const body = sentencesUpTo(c.detail, 220)
    claim('b4', `steps[${i}].body`, body, 'product_fact', [`capability:${id}`])
    return { title: clip(c.title, 50), body }
  })
  const how: Block = {
    _key: 'b4',
    _type: 'howItWorks',
    heading: clip(`How it would run for ${name}`, 90),
    steps,
  }

  // b5 FAQ copied from brand facts.
  const items = profile.faqs.map((id, i) => {
    const f = byId(facts.faqs, id)
    claim('b5', `items[${i}].answer`, f.answer, 'product_fact', [`faq:${f.id}`])
    return { question: f.question, answer: f.answer }
  })
  const role = brief.targetRole.trim().toLowerCase() || 'operations'
  const faq: Block = {
    _key: 'b5',
    _type: 'faq',
    heading: clip(`Questions a ${role} usually asks`, 90),
    items,
  }

  // b6 closing.
  const closingBody = `We walk through how scheduled flights would cover the sites of ${name} and answer your team's questions about airspace, data and security.`
  const closing: Block =
    goal.closing === 'demoForm'
      ? {
          _key: 'b6',
          _type: 'demoForm',
          heading: clip(`Talk to the team that would fly the routes for ${name}`, 90),
          body: clip(closingBody, 280),
          submitLabel: 'Book the call',
          nextSteps: [
            'An inspection lead replies within one working day.',
            'We review your site plan and draw a first route with your team.',
            'You get a written proposal after a site survey.',
          ],
        }
      : {
          _key: 'b6',
          _type: 'ctaBand',
          heading: clip(
            brief.goal === 'download-report'
              ? `See a sample inspection report for ${name}`
              : `Join the Hoverline briefing for ${name}`,
            90,
          ),
          body: clip(closingBody, 240),
          cta: { label: goal.label, href: goal.href },
        }
  claim('b6', 'body', clip(closingBody, goal.closing === 'demoForm' ? 280 : 240), 'positioning')

  const site = facts.siteTypes[siteType]
  return {
    title: clip(`Hoverline for ${name}`, 90),
    seoTitle: clip(`Drone inspection for ${name}`, 60),
    seoDescription: seoDescription(name, site.typicalFindings[0]!),
    blocks: [hero, grid, band, how, faq, closing],
    claims,
  }
}

function seoDescription(name: string, finding: string): string {
  const full = `How Hoverline dock-based drones would fly scheduled routes for ${name} and flag findings such as ${finding.toLowerCase()}.`
  if (full.length <= 160) return full
  const short = `How Hoverline dock-based drones would fly scheduled inspection routes for ${name}.`
  return short.length <= 160 ? short : clip(short, 160)
}

function rank(c: FactCategory): number {
  return { challenges: 0, initiatives: 1, operations: 2, scale: 3, other: 4 }[c]
}

/** Heuristic fact picker: concrete sentences with numbers, plans, problems and operations. */
export function simulateSelectFacts(sentences: string[], max = 12): SelectFactsOutput {
  const picked: SelectFactsOutput['facts'] = []
  sentences.forEach((s, index) => {
    if (s.length < 30 || s.length > 300) return
    const category = categorize(s)
    if (category === 'other') return
    picked.push({ index, category })
  })
  return { facts: picked.slice(0, max) }
}

export function categorize(s: string): FactCategory {
  const t = s.toLowerCase()
  if (
    /\b(challenge|difficult|risk|theft|intrusion|incident|shortage|struggle|pressure|exposed|limited|hard to|delay|losses?|backlog)\w*/.test(
      t,
    )
  )
    return 'challenges'
  if (
    /\b(plan|programme|program|initiative|invest|upgrade|expan|target|pilot|by 20\d\d|will|strategy)\w*/.test(
      t,
    )
  )
    return 'initiatives'
  if (/\d/.test(t)) return 'scale'
  if (
    /\b(operat|run|handle|terminal|berth|patrol|maintain|inspect|site|farm|crane|security|monitor)\w*/.test(
      t,
    )
  )
    return 'operations'
  return 'other'
}
