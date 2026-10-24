/**
 * UI fixtures for PageForge ABM.
 *
 * Used by `lib/abm/client.ts` when NEXT_PUBLIC_ABM_FIXTURES=1 (an in-memory
 * stand-in for /api/abm/* with simulated latency) and by the TEMP stub of
 * `lib/abm/public.ts`. Every prospect here is fictional, every Hoverline
 * number comes from @pageforge/content facts, and the engagement and
 * conversion figures are illustrative.
 */
import { blockSchema, type Block, type Page } from '@pageforge/blocks'
import { facts } from '@pageforge/content'
import type {
  Account,
  AccountBrief,
  ActorRole,
  AuditEntry,
  Campaign,
  CampaignDetail,
  CampaignType,
  Claim,
  ClaimSource,
  ConversionComparison,
  CtaConfig,
  EngagementSummary,
  EventType,
  Industry,
  Lead,
  Meeting,
  Role,
  SeoConfig,
  Source,
  SourceFact,
  TrackEvent,
  TrackingLink,
  Version,
  VersionWithClaims,
  Workspace,
} from './types'

/** Absolute origin for fixture URLs: the browser's own origin, else the configured site. */
export function siteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * The demo script's account has fixed ids, so the page published from the
 * desk (browser fixtures) and the page served by the public route stub
 * (server fixtures) are the same campaign, and the prospect's events land on it.
 */
export const NORTHSTAR_ID = 'cmp_northstar'
export const NORTHSTAR_SLUG = 'northstar-port-authority'
export const NORTHSTAR_TOKEN = 'k7q2m9x4p1za'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// ---------------------------------------------------------------------------
// Product facts (ids exist in @pageforge/content)
// ---------------------------------------------------------------------------

function productFact(id: string): ClaimSource {
  const all = [
    ...facts.capabilities.map((c) => ({ id: c.id, label: c.title })),
    ...facts.stats.map((s) => ({
      id: s.id,
      label: `${s.value}${s.unit ? ` ${s.unit}` : ''} ${s.label}`,
    })),
    ...facts.specs.map((s) => ({ id: s.id, label: `${s.label}: ${s.value}` })),
    ...facts.faqs.map((f) => ({ id: f.id, label: `FAQ: ${f.question}` })),
  ]
  const hit = all.find((f) => f.id === id)
  return { type: 'product_fact', factId: id, label: hit?.label ?? id }
}

const faq = (id: string) => {
  const f = facts.faqs.find((x) => x.id === id)!
  return { question: f.question, answer: f.answer }
}
const stat = (id: string) => {
  const s = facts.stats.find((x) => x.id === id)!
  return { value: s.value, unit: s.unit, label: s.label, basis: s.basis }
}

// ---------------------------------------------------------------------------
// Prospect sites (served by the app at /fictional/[company])
// ---------------------------------------------------------------------------

interface ProspectSeed {
  key: 'northstar' | 'halvorsen'
  name: string
  industry: Industry
  siteCount: number
  path: string
  sources: { path: string; title: string; status: Source['status']; detail: string | null }[]
  facts: { source: number; quote: string; category: SourceFact['category']; included?: boolean }[]
}

const NORTHSTAR: ProspectSeed = {
  key: 'northstar',
  name: 'Northstar Port Authority',
  industry: 'ports',
  siteCount: 4,
  path: '/fictional/northstar-port-authority',
  sources: [
    { path: '', title: 'Northstar Port Authority (fictional)', status: 'ok', detail: null },
    { path: '/facilities', title: 'Terminals and berths', status: 'ok', detail: null },
    { path: '/news', title: 'News: 2024 security review', status: 'ok', detail: null },
    {
      path: '/tenders',
      title: null as unknown as string,
      status: 'robots_disallowed',
      detail: 'robots.txt disallows /tenders for PageForgeBot, so the page was not fetched.',
    },
  ],
  facts: [
    {
      source: 0,
      quote:
        'Northstar Port Authority operates four container terminals and two cruise berths on the east bank of the Harlan estuary.',
      category: 'scale',
    },
    {
      source: 0,
      quote:
        'The port works around the clock, with vessel operations continuing through the night at all four terminals.',
      category: 'operations',
    },
    {
      source: 1,
      quote: 'Terminal 3 handles more than 1.2 million TEU a year across 14 ship-to-shore cranes.',
      category: 'scale',
    },
    {
      source: 1,
      quote:
        'Our security team patrols 11 kilometres of perimeter fence on foot and by vehicle every night.',
      category: 'operations',
    },
    {
      source: 2,
      quote:
        "The port's 2024 security review recommended stronger after-hours coverage at the cruise berths.",
      category: 'initiatives',
    },
    {
      source: 1,
      quote: 'Crane inspections currently require a boom shutdown and a rope-access team.',
      category: 'challenges',
    },
    {
      source: 0,
      quote: 'Northstar sponsors the Harlan estuary rowing regatta each spring.',
      category: 'other',
      included: false,
    },
  ],
}

const HALVORSEN: ProspectSeed = {
  key: 'halvorsen',
  name: 'Halvorsen Solar Partners',
  industry: 'solar',
  siteCount: 6,
  path: '/fictional/halvorsen-solar-partners',
  sources: [
    { path: '', title: 'Halvorsen Solar Partners (fictional)', status: 'ok', detail: null },
    { path: '/portfolio', title: 'Our solar farms', status: 'ok', detail: null },
    {
      path: '/investors',
      title: null as unknown as string,
      status: 'blocked',
      detail: 'The page redirected to a private address (10.0.4.12) and was refused.',
    },
  ],
  facts: [
    {
      source: 1,
      quote: 'Halvorsen Solar Partners runs six solar farms with a combined capacity of 1.4 GW.',
      category: 'scale',
    },
    {
      source: 1,
      quote: 'Each farm is inspected by a two-person crew walking the rows once a quarter.',
      category: 'operations',
    },
    {
      source: 0,
      quote: 'We plan to add storage at three of our farms by 2027.',
      category: 'initiatives',
    },
  ],
}

// ---------------------------------------------------------------------------
// Page templates
// ---------------------------------------------------------------------------

interface ClaimSeed {
  blockKey: string
  field: string
  text: string
  kind: Claim['kind']
  sources: (ClaimSource | { type: 'fact'; index: number })[]
  status?: Claim['status']
  reasons?: string[]
}

interface Template {
  page: Page
  claims: ClaimSeed[]
  seo: Omit<SeoConfig, 'canonicalUrl'>
  cta: CtaConfig
}

/** The unsourced claim simulation mode always includes (spec §10). */
const STAFFING_CLAIM: ClaimSeed = {
  blockKey: 'stats',
  field: 'stats[2].value',
  text: 'cut security staffing costs by 40%',
  kind: 'product_fact',
  sources: [],
  status: 'needs_review',
  reasons: ['No approved Hoverline fact contains "40%".', 'Unsourced statement.'],
}

function northstarTemplate(name = NORTHSTAR.name): Template {
  const short = name.split(' ')[0]!
  return {
    page: {
      kind: 'landing',
      title: `${name}: night perimeter patrols`,
      slug: 'northstar-port-authority',
      seo: {
        title: `Night perimeter patrols for ${name}`.slice(0, 60),
        description: 'x',
        noindex: true,
      },
      blocks: [
        {
          _key: 'hero',
          _type: 'hero',
          variant: 'statement',
          heading: `Night patrols for ${short}'s four terminals`,
          subheading:
            'Docked drones fly the same perimeter route every night, so your security team sees all 11 km of fence, every berth and every crane without sending a patrol out.',
          primaryCta: { label: 'Book a walkthrough', href: '#book' },
          siteType: 'refinery',
        },
        {
          _key: 'stats',
          _type: 'statsBand',
          heading: 'What changes on the night shift',
          stats: [
            stat('response-time'),
            stat('flight-completion'),
            { value: '40', unit: '%', label: 'cut in security staffing costs' },
          ],
        },
        {
          _key: 'features',
          _type: 'featureGrid',
          heading: 'One dock, three night jobs',
          intro:
            'Perimeter patrols, crane checks and berth security share one dock and one flight schedule.',
          features: [
            {
              title: 'Fence lines after dark',
              body: 'A radiometric thermal camera records a temperature for every pixel, so people and vehicles stand out along the fence on the darkest nights.',
            },
            {
              title: 'Cranes without a boom shutdown',
              body: 'A 48 MP camera with 32× hybrid zoom reads nameplates and bolt heads from a 40 m standoff. Routine crane checks no longer need a rope-access team.',
            },
            {
              title: 'Cruise berths after hours',
              body: 'Your 2024 security review asked for after-hours coverage at the cruise berths. When a berth alarm trips, the control room sends the drone in a few clicks.',
            },
          ],
        },
        {
          _key: 'faq',
          _type: 'faq',
          heading: 'Questions from port security teams',
          items: [faq('pilots'), faq('install')],
        },
        {
          _key: 'book',
          _type: 'demoForm',
          heading: 'Walk the east bank route with us',
          body: 'Bring a site plan. We draw the first night route with your security lead and show what a flight would have recorded last week.',
          submitLabel: 'Book a walkthrough',
          nextSteps: [
            'A 30-minute call with a Hoverline solutions engineer',
            'We draw a perimeter route on your site plan',
            'You get a written estimate for one dock',
          ],
        },
      ],
    },
    claims: [
      {
        blockKey: 'hero',
        field: 'heading',
        text: `${short}'s four terminals`,
        kind: 'account_fact',
        sources: [{ type: 'fact', index: 0 }],
      },
      {
        blockKey: 'hero',
        field: 'subheading',
        text: 'Docked drones fly the same perimeter route every night',
        kind: 'product_fact',
        sources: [productFact('scheduled-routes')],
      },
      {
        blockKey: 'hero',
        field: 'subheading',
        text: 'all 11 km of fence',
        kind: 'account_fact',
        sources: [{ type: 'fact', index: 3 }],
      },
      {
        blockKey: 'stats',
        field: 'stats[0].value',
        text: '4 min median time from alarm to drone on scene',
        kind: 'product_fact',
        sources: [productFact('response-time')],
      },
      {
        blockKey: 'stats',
        field: 'stats[1].value',
        text: '96.4% of scheduled flights completed',
        kind: 'product_fact',
        sources: [productFact('flight-completion')],
      },
      STAFFING_CLAIM,
      {
        blockKey: 'features',
        field: 'intro',
        text: 'Perimeter patrols, crane checks and berth security share one dock',
        kind: 'positioning',
        sources: [],
      },
      {
        blockKey: 'features',
        field: 'features[0].body',
        text: 'A radiometric thermal camera records a temperature for every pixel',
        kind: 'product_fact',
        sources: [productFact('thermal')],
      },
      {
        blockKey: 'features',
        field: 'features[1].body',
        text: 'A 48 MP camera with 32× hybrid zoom reads nameplates and bolt heads from a 40 m standoff',
        kind: 'product_fact',
        sources: [productFact('zoom')],
      },
      {
        blockKey: 'features',
        field: 'features[1].body',
        text: 'Routine crane checks no longer need a rope-access team',
        kind: 'account_fact',
        sources: [{ type: 'fact', index: 5 }],
      },
      {
        blockKey: 'features',
        field: 'features[2].body',
        text: 'Your 2024 security review asked for after-hours coverage at the cruise berths',
        kind: 'account_fact',
        sources: [{ type: 'fact', index: 4 }],
        status: 'needs_review',
        reasons: ['"asked for" is not in the quote; the source says "recommended".'],
      },
      {
        blockKey: 'features',
        field: 'features[2].body',
        text: 'the control room sends the drone in a few clicks',
        kind: 'product_fact',
        sources: [productFact('on-demand')],
      },
      {
        blockKey: 'faq',
        field: 'items[0].answer',
        text: 'Certified remote pilots in our operations centre watch every flight',
        kind: 'product_fact',
        sources: [productFact('pilots')],
      },
      {
        blockKey: 'faq',
        field: 'items[1].answer',
        text: 'Most sites go from survey to scheduled flights in under 12 weeks',
        kind: 'product_fact',
        sources: [productFact('install')],
      },
    ],
    seo: {
      title: `Night perimeter patrols for ${name}`.slice(0, 60),
      description:
        `How docked Hoverline drones would cover ${short}'s four terminals, cruise berths and cranes after dark. Prepared for the ${short} security team.`.slice(
          0,
          160,
        ),
      noindex: true,
      ogImageUrl: '/og/home',
    },
    cta: { label: 'Book a walkthrough', kind: 'calendar', formFields: ['role'] },
  }
}

function halvorsenTemplate(): Template {
  return {
    page: {
      kind: 'landing',
      title: 'Halvorsen Solar Partners: row inspections',
      slug: 'halvorsen-solar-partners',
      seo: { title: 'Row inspections for Halvorsen', description: 'x', noindex: true },
      blocks: [
        {
          _key: 'hero',
          _type: 'hero',
          variant: 'statement',
          heading: "Every row of Halvorsen's six farms",
          subheading:
            'A docked drone flies each farm on a fixed route and flags hot modules from a radiometric thermal camera, instead of a two-person crew walking the rows once a quarter.',
          primaryCta: { label: 'Get the inspection plan', href: '#book' },
          siteType: 'substation',
        },
        {
          _key: 'stats',
          _type: 'statsBand',
          heading: 'Measured on live sites',
          stats: [stat('detection-lead'), stat('flight-completion')],
        },
        {
          _key: 'features',
          _type: 'featureGrid',
          heading: 'From hot module to work order',
          features: [
            {
              title: 'Only changes reach your team',
              body: 'Each flight is compared with the previous ones. Unchanged strings are filed; new hot spots go to the review queue.',
            },
            {
              title: 'An inspector signs off every finding',
              body: 'Nothing becomes a work order without a person agreeing.',
            },
          ],
        },
        {
          _key: 'book',
          _type: 'demoForm',
          heading: 'Get an inspection plan for one farm',
          body: 'Tell us which farm to start with. We send a route, a flight schedule and a dock estimate within a week.',
          submitLabel: 'Get the inspection plan',
          nextSteps: [
            'A solutions engineer reviews your site plan',
            'You get a route and an estimate',
          ],
        },
      ],
    },
    claims: [
      {
        blockKey: 'hero',
        field: 'heading',
        text: "Halvorsen's six farms",
        kind: 'account_fact',
        sources: [{ type: 'fact', index: 0 }],
      },
      {
        blockKey: 'hero',
        field: 'subheading',
        text: 'a two-person crew walking the rows once a quarter',
        kind: 'account_fact',
        sources: [{ type: 'fact', index: 1 }],
      },
      {
        blockKey: 'hero',
        field: 'subheading',
        text: 'flags hot modules from a radiometric thermal camera',
        kind: 'product_fact',
        sources: [productFact('thermal')],
      },
      {
        blockKey: 'stats',
        field: 'stats[0].value',
        text: '11 days earlier warning of developing hot spots',
        kind: 'product_fact',
        sources: [productFact('detection-lead')],
      },
      {
        blockKey: 'stats',
        field: 'stats[1].value',
        text: '96.4% of scheduled flights completed',
        kind: 'product_fact',
        sources: [productFact('flight-completion')],
      },
      {
        blockKey: 'stats',
        field: 'stats[2].value',
        text: 'cut inspection costs by 40%',
        kind: 'product_fact',
        sources: [],
        status: 'rejected',
        reasons: ['No approved Hoverline fact contains "40%".', 'Unsourced statement.'],
      },
      {
        blockKey: 'features',
        field: 'features[0].body',
        text: 'Each flight is compared with the previous ones',
        kind: 'product_fact',
        sources: [productFact('change-detection')],
      },
      {
        blockKey: 'features',
        field: 'features[1].body',
        text: 'Nothing becomes a work order without a person agreeing',
        kind: 'product_fact',
        sources: [productFact('review-queue')],
      },
    ],
    seo: {
      title: 'Row inspections for Halvorsen Solar Partners',
      description:
        'How a docked Hoverline drone would inspect the rows at all six Halvorsen farms, and what reaches your team after each flight.',
      noindex: true,
      ogImageUrl: '/og/industries/power-grids',
    },
    cta: { label: 'Get the inspection plan', kind: 'form', formFields: ['role', 'siteCount'] },
  }
}

function genericTemplate(name: string | null, industry: Industry): Template {
  const label = industryNames[industry]
  return {
    page: {
      kind: 'landing',
      title: name ? `${name}: drone inspection` : `Drone inspection for ${label.toLowerCase()}`,
      slug: slugify(name ?? `solutions-${industry}`),
      seo: { title: 'Drone inspection', description: 'x', noindex: !!name },
      blocks: [
        {
          _key: 'hero',
          _type: 'hero',
          variant: 'statement',
          heading: name
            ? `Inspection rounds for ${name}`.slice(0, 90)
            : `Drone inspection for ${label.toLowerCase()}`,
          subheading:
            'A drone lives on site in a weatherproof dock and flies the same route on a schedule, so every image compares like for like with the last one.',
          primaryCta: { label: 'Book a walkthrough', href: '#book' },
          siteType: 'refinery',
        },
        {
          _key: 'stats',
          _type: 'statsBand',
          heading: 'Measured on live sites',
          stats: [
            stat('inspection-hours'),
            stat('response-time'),
            { value: '40', unit: '%', label: 'cut in security staffing costs' },
          ],
        },
        {
          _key: 'book',
          _type: 'demoForm',
          heading: 'See a route drawn on your site plan',
          body: 'A 30-minute call with a solutions engineer. Bring a site plan; leave with a first route.',
          submitLabel: 'Book a walkthrough',
          nextSteps: ['We draw a route on your site plan', 'You get a written estimate'],
        },
      ],
    },
    claims: [
      {
        blockKey: 'hero',
        field: 'subheading',
        text: 'A drone lives on site in a weatherproof dock',
        kind: 'product_fact',
        sources: [productFact('dock')],
      },
      {
        blockKey: 'hero',
        field: 'subheading',
        text: 'flies the same route on a schedule',
        kind: 'product_fact',
        sources: [productFact('scheduled-routes')],
      },
      {
        blockKey: 'stats',
        field: 'stats[0].value',
        text: '71% fewer person-hours on routine visual inspection',
        kind: 'product_fact',
        sources: [productFact('inspection-hours')],
      },
      {
        blockKey: 'stats',
        field: 'stats[1].value',
        text: '4 min median time from alarm to drone on scene',
        kind: 'product_fact',
        sources: [productFact('response-time')],
      },
      STAFFING_CLAIM,
    ],
    seo: {
      title: name
        ? `Drone inspection for ${name}`.slice(0, 60)
        : `Drone inspection for ${label.toLowerCase()}`,
      description: `How docked Hoverline drones inspect ${label.toLowerCase()} on a fixed schedule, and what reaches your team after each flight.`,
      noindex: !!name,
      ogImageUrl: '/og/industries/refineries',
    },
    cta: { label: 'Book a walkthrough', kind: 'calendar', formFields: [] },
  }
}

const industryNames: Record<Industry, string> = {
  ports: 'Ports',
  refineries: 'Refineries',
  'power-grids': 'Power grids',
  'open-pit-mining': 'Open-pit mines',
  solar: 'Solar farms',
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface FixtureSession {
  workspace: Workspace
  role: Role
  liveModels: boolean
}

interface StoredEvent {
  at: string
  campaignId: string | null
  visitorId: string
  type: EventType
  pageKind: TrackEvent['pageKind']
  props: Record<string, unknown>
}

interface StoredVersion extends Version {
  claims: Claim[]
}

export interface FixtureDb {
  v: 1
  seq: number
  session: FixtureSession | null
  accounts: Account[]
  campaigns: Campaign[]
  sources: Source[]
  facts: SourceFact[]
  versions: StoredVersion[]
  events: StoredEvent[]
  leads: Lead[]
  meetings: Meeting[]
  audit: AuditEntry[]
  /** campaignId → ms timestamp when the simulated draft is ready. */
  generating: Record<string, number>
  /** campaignId → the brief it was created from (for duplicate). */
  briefs: Record<string, AccountBrief>
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'account'
  )
}

function nextId(db: FixtureDb, prefix: string): string {
  db.seq++
  return `${prefix}_${db.seq.toString(36).padStart(4, '0')}${Math.random().toString(36).slice(2, 6)}`
}

function token12(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function audit(
  db: FixtureDb,
  campaignId: string | null,
  actorRole: ActorRole,
  action: string,
  detail: Record<string, unknown> = {},
  at = Date.now(),
): void {
  db.audit.push({
    id: db.audit.length + 1,
    createdAt: iso(at),
    campaignId,
    actorRole,
    action,
    detail,
  })
}

function addProspectSources(db: FixtureDb, account: Account, seed: ProspectSeed, at: number): void {
  const base = account.url.replace(/\/$/, '')
  const ids = seed.sources.map((s) => {
    const id = nextId(db, 'src')
    db.sources.push({
      id,
      accountId: account.id,
      url: `${base}${s.path}`,
      title: s.title ?? null,
      fetchedAt: iso(at),
      status: s.status,
      detail: s.detail,
    })
    return id
  })
  for (const f of seed.facts) {
    db.facts.push({
      id: nextId(db, 'fact'),
      sourceId: ids[f.source]!,
      accountId: account.id,
      quote: f.quote,
      category: f.category,
      included: f.included ?? true,
    })
  }
}

function prospectFor(urlOrName: string): ProspectSeed | null {
  const s = urlOrName.toLowerCase()
  if (s.includes('northstar')) return NORTHSTAR
  if (s.includes('halvorsen')) return HALVORSEN
  return null
}

function templateFor(account: Account | null, industry: Industry): Template {
  const p = account ? prospectFor(account.url + account.name) : null
  if (p?.key === 'northstar') return northstarTemplate(account!.name)
  if (p?.key === 'halvorsen') return halvorsenTemplate()
  return genericTemplate(account?.name ?? null, industry)
}

function canonicalFor(c: Campaign): string {
  if (c.type === 'demo') return `${siteOrigin()}/demo/${c.slug}-${c.token}`
  if (c.type === 'campaign') return `${siteOrigin()}/campaign/${c.slug}`
  return `${siteOrigin()}/solutions/${c.industry}`
}

function buildVersion(
  db: FixtureDb,
  campaign: Campaign,
  tpl: Template,
  opts: { number: number; at: number; createdBy: ActorRole; origin: Version['origin'] },
): StoredVersion {
  const id = nextId(db, 'ver')
  const accountFacts = db.facts.filter((f) => f.accountId === campaign.accountId)
  const claims: Claim[] = tpl.claims.map((c) => {
    const sources: ClaimSource[] = []
    let missing = false
    for (const s of c.sources) {
      if (s.type !== 'fact') {
        sources.push(s)
        continue
      }
      const prospect = prospectFor(db.accounts.find((a) => a.id === campaign.accountId)?.url ?? '')
      const quote = prospect?.facts[s.index]?.quote
      const fact = accountFacts.find((f) => f.quote === quote && f.included)
      if (!fact) {
        missing = true
        continue
      }
      const src = db.sources.find((x) => x.id === fact.sourceId)
      sources.push({
        type: 'account_source',
        sourceFactId: fact.id,
        url: src?.url ?? '',
        quote: fact.quote,
      })
    }
    const status = c.status ?? (missing ? 'needs_review' : 'supported')
    const reasons = c.reasons ?? (missing ? ['The account fact this claim used is excluded.'] : [])
    return {
      id: nextId(db, 'clm'),
      versionId: id,
      blockKey: c.blockKey,
      field: c.field,
      text: c.text,
      kind: c.kind,
      sources,
      status,
      validator: { ok: status !== 'needs_review' && reasons.length === 0, reasons },
      reviewedBy: status === 'rejected' ? 'reviewer' : null,
      reviewedAt: status === 'rejected' ? iso(opts.at) : null,
      note: status === 'rejected' ? 'Not in our approved facts.' : null,
    }
  })
  let page = structuredClone(tpl.page)
  for (const c of claims) if (c.status === 'rejected') page = removeClaimFromPage(page, c, claims)
  return {
    id,
    campaignId: campaign.id,
    number: opts.number,
    createdAt: iso(opts.at),
    createdBy: opts.createdBy,
    origin: opts.origin,
    state: 'in_review',
    page,
    seo: { ...tpl.seo, canonicalUrl: canonicalFor(campaign) },
    cta: tpl.cta,
    model: 'simulation',
    simulated: true,
    approvedBy: null,
    approvedAt: null,
    claims,
  }
}

/** Remove a rejected claim's sentence (or its stat item) from the page. */
function removeClaimFromPage(page: Page, claim: Claim, all: Claim[]): Page {
  const blocks = page.blocks.map((b) => ({ ...b })) as Block[]
  const idx = blocks.findIndex((b) => b._key === claim.blockKey)
  if (idx < 0) return page
  const block = blocks[idx] as Record<string, unknown>
  const item = /^(stats|metrics)\[(\d+)\]\./.exec(claim.field)
  if (item) {
    const key = item[1]!
    const n = Number(item[2])
    const arr = [...((block[key] as unknown[]) ?? [])]
    if (n < arr.length) {
      arr.splice(n, 1)
      block[key] = arr
      // Later items move up one: keep their claims pointing at the same item.
      for (const c of all) {
        if (c.blockKey !== claim.blockKey || c.id === claim.id) continue
        const m = new RegExp(`^${key}\\[(\\d+)\\](.*)$`).exec(c.field)
        if (m && Number(m[1]) > n) c.field = `${key}[${Number(m[1]) - 1}]${m[2]}`
      }
    }
    return { ...page, blocks }
  }
  const segs = claim.field.split('.')
  let parent: Record<string, unknown> = block
  for (let i = 0; i < segs.length - 1; i++) {
    const m = /^(\w+)(?:\[(\d+)\])?$/.exec(segs[i]!)
    if (!m) return page
    let next = parent[m[1]!] as unknown
    if (m[2] !== undefined) {
      const arr = [...(next as unknown[])]
      arr[Number(m[2])] = { ...(arr[Number(m[2])] as object) }
      parent[m[1]!] = arr
      next = arr[Number(m[2])]
    } else {
      next = { ...(next as object) }
      parent[m[1]!] = next
    }
    parent = next as Record<string, unknown>
  }
  const last = segs.at(-1)!
  const value = parent[last]
  if (typeof value !== 'string') return page
  const sentences = value.match(/[^.!?]+[.!?]*\s*/g) ?? [value]
  const kept = sentences.filter((s) => !s.toLowerCase().includes(claim.text.toLowerCase()))
  let out = kept.join('').trim()
  if (kept.length === sentences.length) {
    // The claim is a phrase inside a sentence: drop the phrase itself.
    out = value
      .replace(claim.text, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  parent[last] = out
  return { ...page, blocks }
}

function computeBlockers(v: StoredVersion): string[] {
  const out: string[] = []
  const n = v.claims.filter((c) => c.status === 'needs_review').length
  if (n) out.push(n === 1 ? '1 claim needs review' : `${n} claims need review`)
  for (const b of v.page.blocks) {
    const r = blockSchema.safeParse(b)
    if (!r.success) out.push(`${b._type}: ${r.error.issues[0]?.message ?? 'invalid'}`)
  }
  const banned = facts.voice.bannedPhrases
  const text = JSON.stringify(v.page.blocks).toLowerCase()
  for (const p of banned) if (text.includes(p.toLowerCase())) out.push(`Banned phrase: "${p}"`)
  return out
}

function withClaims(v: StoredVersion): VersionWithClaims {
  return { ...structuredClone(v), publishBlockers: computeBlockers(v) }
}

interface SeedCampaign {
  id?: string
  account: {
    seed?: ProspectSeed
    name: string
    industry: Industry
    siteCount: number | null
    targetRole: string
    painPoints: string[]
    salesNotes?: string
  } | null
  type: CampaignType
  industry: Industry
  goal: Campaign['goal']
  channel: AccountBrief['sourceChannel'] | null
  status: Campaign['status']
  ageMs: number
  slug?: string
  token?: string
}

export function seedDb(now = Date.now(), opts: { northstar?: boolean } = {}): FixtureDb {
  const db: FixtureDb = {
    v: 1,
    seq: 0,
    session: null,
    accounts: [],
    campaigns: [],
    sources: [],
    facts: [],
    versions: [],
    events: [],
    leads: [],
    meetings: [],
    audit: [],
    generating: {},
    briefs: {},
  }

  const make = (s: SeedCampaign): Campaign => {
    const created = now - s.ageMs
    let account: Account | null = null
    if (s.account) {
      const url = s.account.seed
        ? `${siteOrigin()}${s.account.seed.path}`
        : `https://${slugify(s.account.name)}.example`
      account = {
        id: nextId(db, 'acc'),
        workspace: 'demo',
        createdAt: iso(created),
        name: s.account.name,
        url,
        domain: new URL(url).host,
        industry: s.account.industry,
        siteCount: s.account.siteCount,
        targetRole: s.account.targetRole,
        painPoints: s.account.painPoints,
        salesNotes: s.account.salesNotes ?? null,
        createdBy: 'marketer',
      }
      db.accounts.push(account)
    }
    const slug = s.slug ?? slugify(s.account?.name ?? `solutions-${s.industry}`)
    const campaign: Campaign = {
      id: s.id ?? nextId(db, 'cmp'),
      workspace: 'demo',
      createdAt: iso(created),
      updatedAt: iso(created),
      accountId: account?.id ?? null,
      type: s.type,
      industry: s.industry,
      goal: s.goal,
      sourceChannel: s.channel,
      status: s.status,
      slug,
      token: s.type === 'demo' ? (s.token ?? token12()) : null,
      utmCampaign: `abm-${slug}`.slice(0, 60),
      expiresAt: s.type === 'solutions' ? null : iso(created + 60 * DAY),
      noindex: s.type !== 'solutions',
      currentVersionId: null,
      publishedVersionId: null,
      publishedAt: null,
      briefAt: iso(created),
      reviewReadyAt: null,
      createdBy: 'marketer',
    }
    db.campaigns.push(campaign)
    if (account) {
      db.briefs[campaign.id] = {
        companyName: account.name,
        companyUrl: account.url,
        industry: account.industry,
        siteCount: account.siteCount ?? undefined,
        campaignType: s.type,
        goal: s.goal,
        painPoints: account.painPoints,
        targetRole: account.targetRole ?? '',
        sourceChannel: s.channel ?? 'email',
        salesNotes: account.salesNotes ?? undefined,
      }
    }
    audit(db, campaign.id, 'marketer', 'brief.created', { account: account?.name ?? null }, created)
    if (account && s.account?.seed) {
      addProspectSources(db, account, s.account.seed, created + 40_000)
      audit(
        db,
        campaign.id,
        'system',
        'sources.fetched',
        { pages: s.account.seed.sources.length },
        created + 40_000,
      )
    }
    return campaign
  }

  const publish = (c: Campaign, at: number, opts: { approveAt: number; reviewReadyAt: number }) => {
    const tpl = templateFor(db.accounts.find((a) => a.id === c.accountId) ?? null, c.industry)
    const v = buildVersion(db, c, tpl, {
      number: 1,
      at: opts.reviewReadyAt,
      createdBy: 'system',
      origin: 'ai_draft',
    })
    for (const claim of v.claims) {
      if (claim.status === 'needs_review') {
        claim.status = 'supported'
        claim.reviewedBy = 'reviewer'
        claim.reviewedAt = iso(opts.approveAt - 60_000)
      }
    }
    v.state = 'approved'
    v.approvedBy = 'reviewer'
    v.approvedAt = iso(opts.approveAt)
    db.versions.push(v)
    c.currentVersionId = v.id
    c.publishedVersionId = v.id
    c.publishedAt = iso(at)
    c.reviewReadyAt = iso(opts.reviewReadyAt)
    c.updatedAt = iso(at)
    audit(
      db,
      c.id,
      'system',
      'draft.generated',
      { version: 1, model: 'simulation' },
      opts.reviewReadyAt,
    )
    audit(db, c.id, 'reviewer', 'version.approved', { version: 1 }, opts.approveAt)
    audit(db, c.id, 'marketer', 'campaign.published', { version: 1 }, at)
    return v
  }

  // 1. In review. The server stub's copy holds Northstar (published as if the
  // demo script had run); the desk starts without it so the script creates it.
  if (opts.northstar) {
    const northstar = make({
      id: NORTHSTAR_ID,
      account: {
        seed: NORTHSTAR,
        name: NORTHSTAR.name,
        industry: 'ports',
        siteCount: 4,
        targetRole: 'Head of Security',
        painPoints: [
          'night-time perimeter patrols',
          'crane inspections',
          'berth security after hours',
        ],
        salesNotes: 'Met their security lead at TOC Europe. Budget cycle closes in March.',
      },
      type: 'demo',
      industry: 'ports',
      goal: 'book-meeting',
      channel: 'email',
      status: 'in_review',
      ageMs: 26 * MIN,
      slug: NORTHSTAR_SLUG,
      token: NORTHSTAR_TOKEN,
    })
    const v = buildVersion(db, northstar, northstarTemplate(), {
      number: 1,
      at: now - 19 * MIN,
      createdBy: 'system',
      origin: 'ai_draft',
    })
    db.versions.push(v)
    northstar.currentVersionId = v.id
    northstar.reviewReadyAt = v.createdAt
    northstar.updatedAt = v.createdAt
  } else {
    const calloway = make({
      account: {
        name: 'Calloway Bay Terminals',
        industry: 'ports',
        siteCount: 2,
        targetRole: 'Port Security Manager',
        painPoints: ['quay crane checks', 'gate queues at night'],
      },
      type: 'demo',
      industry: 'ports',
      goal: 'book-meeting',
      channel: 'linkedin',
      status: 'in_review',
      ageMs: 52 * MIN,
    })
    const v = buildVersion(db, calloway, templateFor(db.accounts.at(-1)!, 'ports'), {
      number: 1,
      at: now - 41 * MIN,
      createdBy: 'system',
      origin: 'ai_draft',
    })
    db.versions.push(v)
    calloway.currentVersionId = v.id
    calloway.reviewReadyAt = v.createdAt
    calloway.updatedAt = v.createdAt
    audit(
      db,
      calloway.id,
      'system',
      'draft.generated',
      { version: 1, model: 'simulation', claims: v.claims.length },
      now - 41 * MIN,
    )
  }

  // 2. Halvorsen: live campaign page with engagement and a lead.
  const halvorsen = make({
    account: {
      seed: HALVORSEN,
      name: HALVORSEN.name,
      industry: 'solar',
      siteCount: 6,
      targetRole: 'Head of Asset Management',
      painPoints: ['quarterly walk-downs miss hot modules', 'storage build-out in 2027'],
    },
    type: 'campaign',
    industry: 'solar',
    goal: 'download-report',
    channel: 'linkedin',
    status: 'published',
    ageMs: 9 * DAY,
  })
  publish(halvorsen, now - 8 * DAY, {
    reviewReadyAt: now - 9 * DAY + 11 * MIN,
    approveAt: now - 8 * DAY - 2 * HOUR,
  })

  // 3. Ports solutions page: the generic baseline.
  const ports = make({
    account: null,
    type: 'solutions',
    industry: 'ports',
    goal: 'book-meeting',
    channel: null,
    status: 'published',
    ageMs: 21 * DAY,
    slug: 'ports',
  })
  publish(ports, now - 20 * DAY, {
    reviewReadyAt: now - 21 * DAY + 9 * MIN,
    approveAt: now - 20 * DAY - 3 * HOUR,
  })

  // 4. Brightwater: paused after a first round.
  const brightwater = make({
    account: {
      name: 'Brightwater Refining',
      industry: 'refineries',
      siteCount: 1,
      targetRole: 'Inspection Manager',
      painPoints: ['tank roof inspections', 'flare stack checks'],
    },
    type: 'demo',
    industry: 'refineries',
    goal: 'book-meeting',
    channel: 'sales-sequence',
    status: 'paused',
    ageMs: 34 * DAY,
    token: 'r8w3n6t2c9vd',
  })
  publish(brightwater, now - 33 * DAY, {
    reviewReadyAt: now - 34 * DAY + 14 * MIN,
    approveAt: now - 33 * DAY - HOUR,
  })
  audit(db, brightwater.id, 'marketer', 'campaign.paused', {}, now - 6 * DAY)
  brightwater.updatedAt = iso(now - 6 * DAY)

  // 5. Kestrel: brief only.
  make({
    account: {
      name: 'Kestrel Grid Cooperative',
      industry: 'power-grids',
      siteCount: 38,
      targetRole: 'Substation Maintenance Lead',
      painPoints: ['thermography rounds on 38 substations', 'storm response'],
    },
    type: 'demo',
    industry: 'power-grids',
    goal: 'book-meeting',
    channel: 'event',
    status: 'draft',
    ageMs: 3 * HOUR,
  })

  // Engagement (illustrative).
  const ev = (
    c: Campaign,
    visitor: string,
    type: EventType,
    ago: number,
    props: Record<string, unknown> = {},
  ) =>
    db.events.push({
      at: iso(now - ago),
      campaignId: c.id,
      visitorId: visitor,
      type,
      pageKind: c.type === 'solutions' ? 'generic' : 'account',
      props,
    })
  const v1 = 'v3f9a1c2d7'
  const v2 = 'v8b2e6f0a4'
  ev(halvorsen, v1, 'page_view', 2 * DAY + 3 * HOUR)
  ev(halvorsen, v1, 'scroll_depth', 2 * DAY + 3 * HOUR - MIN, { depth: 25 })
  ev(halvorsen, v1, 'scroll_depth', 2 * DAY + 3 * HOUR - 2 * MIN, { depth: 50 })
  ev(halvorsen, v2, 'page_view', 26 * HOUR)
  ev(halvorsen, v2, 'scroll_depth', 26 * HOUR - MIN, { depth: 25 })
  ev(halvorsen, v1, 'page_view', 3 * HOUR)
  ev(halvorsen, v1, 'scroll_depth', 3 * HOUR - MIN, { depth: 25 })
  ev(halvorsen, v1, 'scroll_depth', 3 * HOUR - MIN, { depth: 50 })
  ev(halvorsen, v1, 'scroll_depth', 3 * HOUR - 2 * MIN, { depth: 75 })
  ev(halvorsen, v1, 'scroll_depth', 3 * HOUR - 3 * MIN, { depth: 100 })
  ev(halvorsen, v1, 'cta_click', 3 * HOUR - 3 * MIN, { label: 'Get the inspection plan' })
  ev(halvorsen, v1, 'form_start', 3 * HOUR - 4 * MIN, { form: 'lead' })
  ev(halvorsen, v1, 'form_submit', 3 * HOUR - 6 * MIN, { form: 'lead' })
  ev(brightwater, 'v1c7d3e9b5', 'page_view', 12 * DAY)
  ev(brightwater, 'v1c7d3e9b5', 'scroll_depth', 12 * DAY - MIN, { depth: 25 })
  ev(ports, 'v5e1a8c3f2', 'page_view', 4 * DAY)

  const lead = (l: Omit<Lead, 'id' | 'createdAt'> & { ago: number }): Lead => {
    const { ago, ...rest } = l
    const out: Lead = { id: nextId(db, 'lead'), createdAt: iso(now - ago), ...rest }
    db.leads.push(out)
    return out
  }
  lead({
    ago: 3 * HOUR - 6 * MIN,
    campaignId: halvorsen.id,
    accountId: halvorsen.accountId,
    visitorId: v1,
    name: 'Ingrid Solberg',
    email: 'ingrid.solberg@halvorsen-solar.example',
    company: 'Halvorsen Solar Partners',
    role: 'Head of Asset Management',
    message: null,
    pageUrl: `${siteOrigin()}/campaign/${halvorsen.slug}`,
    utm: { source: 'linkedin', medium: 'social', campaign: halvorsen.utmCampaign },
    crmProvider: 'hubspot',
    crmId: '18342',
    crmStatus: 'synced',
    crmError: null,
  })
  lead({
    ago: 12 * DAY - 9 * MIN,
    campaignId: brightwater.id,
    accountId: brightwater.accountId,
    visitorId: 'v1c7d3e9b5',
    name: 'Dale Whitcombe',
    email: 'd.whitcombe@brightwater-refining.example',
    company: 'Brightwater Refining',
    role: 'Inspection Manager',
    message: 'Can the dock sit outside our Zone 2 boundary?',
    pageUrl: `${siteOrigin()}/demo/${brightwater.slug}-${brightwater.token}`,
    utm: { source: 'sales-sequence', medium: 'email', campaign: brightwater.utmCampaign },
    crmProvider: 'hubspot',
    crmId: null,
    crmStatus: 'failed',
    crmError: 'HubSpot answered 429 (rate limited). Saved in the built-in CRM.',
  })
  lead({
    ago: 4 * DAY - 7 * MIN,
    campaignId: ports.id,
    accountId: null,
    visitorId: 'v5e1a8c3f2',
    name: 'Marta Kowalczyk',
    email: 'm.kowalczyk@vellmar-harbour.example',
    company: 'Vellmar Harbour Board',
    role: 'Harbour Master',
    message: null,
    pageUrl: `${siteOrigin()}/solutions/ports`,
    utm: {},
    crmProvider: 'builtin',
    crmId: null,
    crmStatus: 'synced',
    crmError: null,
  })

  db.meetings.push({
    id: nextId(db, 'mtg'),
    createdAt: iso(now - 2 * HOUR),
    campaignId: halvorsen.id,
    leadId: db.leads[0]!.id,
    slotStart: iso(now + 2 * DAY),
    timezone: 'Europe/Oslo',
  })
  ev(halvorsen, v1, 'meeting_booked', 2 * HOUR, { slot: iso(now + 2 * DAY) })

  return db
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

export function summarizeEngagement(
  db: FixtureDb,
  campaignId: string,
  now = Date.now(),
): EngagementSummary {
  const events = db.events
    .filter((e) => e.campaignId === campaignId)
    .sort((a, b) => a.at.localeCompare(b.at))
  const week = now - 7 * DAY
  const visitsBy = new Map<string, number>()
  let maxScroll = 0
  let recentCta = false
  for (const e of events) {
    if (e.type === 'page_view' && new Date(e.at).getTime() >= week) {
      visitsBy.set(e.visitorId, (visitsBy.get(e.visitorId) ?? 0) + 1)
    }
    if (e.type === 'scroll_depth') maxScroll = Math.max(maxScroll, Number(e.props.depth) || 0)
    if (e.type === 'cta_click' && new Date(e.at).getTime() >= week) recentCta = true
  }
  const count = (t: EventType) => events.filter((e) => e.type === t).length
  return {
    campaignId,
    visitors: new Set(events.map((e) => e.visitorId)).size,
    views: count('page_view'),
    maxScroll,
    ctaClicks: count('cta_click'),
    formStarts: count('form_start'),
    formSubmits: count('form_submit'),
    meetings: count('meeting_booked'),
    lastActiveAt: events.at(-1)?.at ?? null,
    hot: [...visitsBy.values()].some((n) => n >= 2) || maxScroll >= 75 || recentCta,
    timeline: events
      .slice()
      .reverse()
      .map((e) => ({ at: e.at, visitorId: e.visitorId, type: e.type, props: e.props })),
  }
}

function trackingLinks(c: Campaign): TrackingLink[] {
  if (c.type === 'solutions') return []
  const base = canonicalFor(c)
  const channels: TrackingLink['channel'][] = ['email', 'linkedin', 'sales-sequence']
  const medium = { email: 'email', linkedin: 'social', 'sales-sequence': 'email' } as const
  return channels.map((ch) => {
    const u = new URL(base)
    u.searchParams.set('utm_source', ch)
    u.searchParams.set('utm_medium', medium[ch as keyof typeof medium])
    u.searchParams.set('utm_campaign', c.utmCampaign)
    u.searchParams.set('utm_content', 'abm-page')
    return { channel: ch, url: u.toString() }
  })
}

export function campaignDetail(db: FixtureDb, c: Campaign): CampaignDetail {
  const account = db.accounts.find((a) => a.id === c.accountId) ?? null
  const versions = db.versions
    .filter((v) => v.campaignId === c.id)
    .sort((a, b) => b.number - a.number)
  const current = versions.find((v) => v.id === c.currentVersionId) ?? null
  const live = ['published'].includes(c.status) && c.publishedVersionId
  return {
    ...structuredClone(c),
    account: account ? structuredClone(account) : null,
    sources: db.sources.filter((s) => s.accountId === c.accountId && account),
    facts: db.facts.filter((f) => f.accountId === c.accountId && account),
    versions: versions.map((v) => ({
      id: v.id,
      number: v.number,
      createdAt: v.createdAt,
      origin: v.origin,
      state: v.state,
      createdBy: v.createdBy,
    })),
    current: current ? withClaims(current) : null,
    liveUrl: live ? canonicalFor(c) : null,
    trackingLinks: trackingLinks(c),
  }
}

export function overview(db: FixtureDb) {
  const comparison: ConversionComparison = {
    account: { visitors: 64, formRate: 0.094, meetingRate: 0.047 },
    generic: { visitors: 412, formRate: 0.019, meetingRate: 0.007 },
    insufficientSample: true,
    illustrative: true,
  }
  const allClaims = db.versions.flatMap((v) => v.claims)
  const sourced = allClaims.filter((c) => c.kind === 'positioning' || c.sources.length > 0)
  const rejected = allClaims.filter((c) => c.status === 'rejected')
  const reviewTimes = db.campaigns
    .filter((c) => c.reviewReadyAt)
    .map((c) => new Date(c.reviewReadyAt!).getTime() - new Date(c.briefAt).getTime())
  const publishTimes = db.campaigns
    .filter((c) => c.publishedAt)
    .map((c) => new Date(c.publishedAt!).getTime() - new Date(c.briefAt).getTime())
  const median = (xs: number[]) => {
    if (!xs.length) return null
    const s = [...xs].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2)
  }
  const pages = new Set(db.versions.map((v) => v.id)).size || 1
  return {
    comparison,
    review: {
      avgClaims: Math.round((allClaims.length / pages) * 10) / 10,
      pctSourced: allClaims.length ? (sourced.length / allClaims.length) * 100 : 0,
      pctRejected: allClaims.length ? (rejected.length / allClaims.length) * 100 : 0,
      medianBriefToReviewMs: median(reviewTimes),
      medianBriefToPublishMs: median(publishTimes),
    },
  }
}

/** The next 10 working days, 30-min slots 10:00–17:00 in Kolkata and New York. */
export function fixtureSlots(now = Date.now(), booked: string[] = []): string[] {
  const out = new Set<string>()
  const zones = [
    { offsetMin: 330 }, // Asia/Kolkata, no DST
    { offsetMin: -240 }, // US Eastern (EDT); good enough for fixtures
  ]
  const start = new Date(now)
  let days = 0
  for (let d = 1; days < 10 && d < 20; d++) {
    const day = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + d),
    )
    const dow = day.getUTCDay()
    if (dow === 0 || dow === 6) continue
    days++
    for (const z of zones) {
      for (let h = 10; h < 17; h++) {
        for (const m of [0, 30]) {
          // Skip about a third of slots so the calendar looks booked.
          if ((d * 7 + h * 3 + m) % 5 === 0) continue
          const t =
            Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m) -
            z.offsetMin * MIN
          out.add(new Date(t).toISOString())
        }
      }
    }
  }
  return [...out].filter((s) => !booked.includes(s)).sort()
}

// ---------------------------------------------------------------------------
// The fixture API (what /api/abm/* answers)
// ---------------------------------------------------------------------------

export interface FixtureResponse {
  status: number
  body: unknown
}

const ok = (body: unknown, status = 200): FixtureResponse => ({ status, body })
const fail = (status: number, error: string, fields?: Record<string, string>): FixtureResponse => ({
  status,
  body: fields ? { error, fields } : { error },
})

function roleOf(db: FixtureDb): Role | null {
  return db.session?.role ?? null
}

function requireRole(db: FixtureDb, roles: Role[], what: string): FixtureResponse | null {
  const r = roleOf(db)
  if (!r) return fail(401, 'Choose a role to continue.')
  if (r === 'admin' || roles.includes(r)) return null
  const names = roles.map((x) => (x === 'sales' ? 'sales rep' : x)).join(' or ')
  return fail(403, `Only a ${names} can ${what}.`)
}

function validateBrief(b: Partial<AccountBrief>): Record<string, string> {
  const e: Record<string, string> = {}
  if (!b.companyName?.trim()) e.companyName = 'Enter the company name.'
  else if (b.companyName.length > 80) e.companyName = 'Keep the name under 80 characters.'
  if (!b.companyUrl?.trim()) e.companyUrl = 'Enter the company website.'
  else if (!/^https?:\/\/[^\s/]+\.[^\s]+|^https?:\/\/localhost/.test(b.companyUrl))
    e.companyUrl = 'Use a full http(s) address, like https://example.com.'
  if (!b.targetRole?.trim()) e.targetRole = 'Who will read the page? Add a job title.'
  if (b.siteCount !== undefined && (b.siteCount < 1 || b.siteCount > 10000))
    e.siteCount = 'Between 1 and 10,000 sites.'
  if ((b.painPoints?.length ?? 0) > 6) e.painPoints = 'Up to six pain points.'
  return e
}

function createFromBrief(
  db: FixtureDb,
  brief: AccountBrief,
  origin: 'brief' | 'duplicate',
): Campaign {
  const now = Date.now()
  const role = roleOf(db) ?? 'marketer'
  const url = brief.companyUrl.trim()
  const account: Account = {
    id: nextId(db, 'acc'),
    workspace: db.session?.workspace ?? 'demo',
    createdAt: iso(now),
    name: brief.companyName.trim(),
    url,
    domain: (() => {
      try {
        return new URL(url).host
      } catch {
        return url
      }
    })(),
    industry: brief.industry,
    siteCount: brief.siteCount ?? null,
    targetRole: brief.targetRole,
    painPoints: brief.painPoints,
    salesNotes: brief.salesNotes ?? null,
    createdBy: role,
  }
  db.accounts.push(account)
  let slug = slugify(brief.campaignType === 'solutions' ? brief.industry : brief.companyName)
  while (
    db.campaigns.some(
      (c) => c.slug === slug && c.type === brief.campaignType && c.status !== 'archived',
    )
  ) {
    slug = `${slug}-${Math.floor(Math.random() * 90 + 10)}`
  }
  const days = brief.expiresInDays ?? (brief.campaignType === 'solutions' ? null : 60)
  const isNorthstar =
    brief.campaignType === 'demo' &&
    prospectFor(url)?.key === 'northstar' &&
    !db.campaigns.some((c) => c.id === NORTHSTAR_ID)
  if (isNorthstar) slug = NORTHSTAR_SLUG
  const campaign: Campaign = {
    id: isNorthstar ? NORTHSTAR_ID : nextId(db, 'cmp'),
    workspace: account.workspace,
    createdAt: iso(now),
    updatedAt: iso(now),
    accountId: brief.campaignType === 'solutions' ? null : account.id,
    type: brief.campaignType,
    industry: brief.industry,
    goal: brief.goal,
    sourceChannel: brief.sourceChannel,
    status: 'draft',
    slug,
    token: isNorthstar ? NORTHSTAR_TOKEN : brief.campaignType === 'demo' ? token12() : null,
    utmCampaign: `abm-${slug}`.slice(0, 60),
    expiresAt: days ? iso(now + days * DAY) : null,
    noindex: brief.campaignType !== 'solutions',
    currentVersionId: null,
    publishedVersionId: null,
    publishedAt: null,
    briefAt: iso(now),
    reviewReadyAt: null,
    createdBy: role,
  }
  if (brief.campaignType === 'solutions') campaign.accountId = account.id
  db.campaigns.push(campaign)
  db.briefs[campaign.id] = brief
  audit(db, campaign.id, role, origin === 'brief' ? 'brief.created' : 'campaign.duplicated', {
    account: account.name,
  })
  return campaign
}

function finishGenerating(db: FixtureDb, now = Date.now()): void {
  for (const [id, readyAt] of Object.entries(db.generating)) {
    if (now < readyAt) continue
    delete db.generating[id]
    const c = db.campaigns.find((x) => x.id === id)
    if (!c) continue
    const account = db.accounts.find((a) => a.id === c.accountId) ?? null
    const number = db.versions.filter((v) => v.campaignId === id).length + 1
    const v = buildVersion(db, c, templateFor(account, c.industry), {
      number,
      at: readyAt,
      createdBy: 'system',
      origin: 'ai_draft',
    })
    db.versions.push(v)
    c.currentVersionId = v.id
    c.status = 'in_review'
    c.reviewReadyAt = c.reviewReadyAt ?? iso(readyAt)
    c.updatedAt = iso(readyAt)
    audit(
      db,
      c.id,
      'system',
      'draft.generated',
      { version: number, model: 'simulation', claims: v.claims.length },
      readyAt,
    )
  }
}

function currentOf(db: FixtureDb, versionId: string) {
  const v = db.versions.find((x) => x.id === versionId)
  const c = v ? db.campaigns.find((x) => x.id === v.campaignId) : undefined
  return { v, c }
}

/** Copy of an approved version as a fresh draft, so edits never touch what was approved. */
function forkIfApproved(db: FixtureDb, v: StoredVersion, c: Campaign): StoredVersion {
  if (v.state !== 'approved') return v
  const number =
    Math.max(...db.versions.filter((x) => x.campaignId === c.id).map((x) => x.number)) + 1
  const id = nextId(db, 'ver')
  const copy: StoredVersion = {
    ...structuredClone(v),
    id,
    number,
    createdAt: iso(Date.now()),
    createdBy: roleOf(db) ?? 'marketer',
    origin: 'edit',
    state: 'draft',
    approvedBy: null,
    approvedAt: null,
    claims: v.claims.map((cl) => ({
      ...structuredClone(cl),
      id: nextId(db, 'clm'),
      versionId: id,
    })),
  }
  db.versions.push(copy)
  c.currentVersionId = id
  if (c.status === 'approved') c.status = 'in_review'
  return copy
}

export function handleFixture(
  db: FixtureDb,
  method: string,
  rawPath: string,
  body: unknown,
): FixtureResponse {
  finishGenerating(db)
  const url = new URL(rawPath, 'http://fixtures.local')
  const parts = url.pathname
    .replace(/^\/api\/abm\/?/, '')
    .split('/')
    .filter(Boolean)
  const [head, id, sub] = parts
  const role = roleOf(db)
  const actor: ActorRole = role ?? 'system'
  const b = (body ?? {}) as Record<string, unknown>

  // ---- session
  if (head === 'session') {
    if (method === 'GET') return db.session ? ok(db.session) : fail(401, 'No session.')
    if (method === 'DELETE') {
      db.session = null
      return ok(null, 204)
    }
    if (method === 'POST') {
      const workspace = (b.workspace as Workspace) ?? 'demo'
      if (workspace === 'main') {
        if (b.password !== 'hoverline')
          return fail(401, 'That password did not match.', {
            password: 'That password did not match.',
          })
        db.session = { workspace: 'main', role: 'admin', liveModels: false }
      } else {
        const r = b.role as Role
        if (!['marketer', 'sales', 'reviewer'].includes(r)) return fail(400, 'Pick a role.')
        db.session = { workspace: 'demo', role: r, liveModels: false }
      }
      return ok({ workspace: db.session.workspace, role: db.session.role })
    }
  }

  // ---- public endpoints
  if (head === 'events' && method === 'POST') {
    const e = b as unknown as TrackEvent
    db.events.push({
      at: iso(Date.now()),
      campaignId: e.campaignId,
      visitorId: e.visitorId,
      type: e.type,
      pageKind: e.pageKind,
      props: e.props ?? {},
    })
    return ok(null, 204)
  }
  if (head === 'slots' && method === 'GET') {
    const cid = url.searchParams.get('campaignId')
    const booked = db.meetings.filter((m) => m.campaignId === cid).map((m) => m.slotStart)
    return ok({ slots: fixtureSlots(Date.now(), booked) })
  }
  if (head === 'meetings' && method === 'POST') {
    const errs: Record<string, string> = {}
    if (!String(b.name ?? '').trim()) errs.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email ?? '')))
      errs.email = 'Enter a work email address.'
    if (!String(b.company ?? '').trim()) errs.company = 'Enter your company.'
    if (Object.keys(errs).length) return fail(400, 'Check the highlighted fields.', errs)
    const cid = (b.campaignId as string) ?? null
    if (db.meetings.some((m) => m.campaignId === cid && m.slotStart === b.slotStart))
      return fail(409, 'Someone just booked that slot. Pick another time.')
    const c = db.campaigns.find((x) => x.id === cid)
    let leadId = (b.leadId as string) ?? null
    if (!leadId) {
      const l: Lead = {
        id: nextId(db, 'lead'),
        createdAt: iso(Date.now()),
        campaignId: cid,
        accountId: c?.accountId ?? null,
        visitorId: (b.visitorId as string) ?? null,
        name: String(b.name),
        email: String(b.email),
        company: String(b.company),
        role: null,
        message: null,
        pageUrl: c ? canonicalFor(c) : siteOrigin(),
        utm: {},
        crmProvider: 'builtin',
        crmId: null,
        crmStatus: 'synced',
        crmError: null,
      }
      db.leads.push(l)
      leadId = l.id
    }
    const m: Meeting = {
      id: nextId(db, 'mtg'),
      createdAt: iso(Date.now()),
      campaignId: cid,
      leadId,
      slotStart: String(b.slotStart),
      timezone: String(b.timezone ?? 'UTC'),
    }
    db.meetings.push(m)
    audit(db, cid, 'system', 'meeting.booked', { slot: m.slotStart })
    return ok({ meetingId: m.id })
  }
  if (head === 'leads' && method === 'POST') {
    const fields = (b.fields ?? {}) as Record<string, string>
    const errs: Record<string, string> = {}
    if (!fields.name?.trim()) errs.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email ?? ''))
      errs.email = 'Enter a work email address.'
    if (!fields.company?.trim()) errs.company = 'Enter your company.'
    if (Object.keys(errs).length) return fail(400, 'Check the highlighted fields.', errs)
    const cid = (b.campaignId as string) ?? null
    const c = db.campaigns.find((x) => x.id === cid)
    const l: Lead = {
      id: nextId(db, 'lead'),
      createdAt: iso(Date.now()),
      campaignId: cid,
      accountId: c?.accountId ?? null,
      visitorId: (b.visitorId as string) ?? null,
      name: fields.name!,
      email: fields.email!,
      company: fields.company!,
      role: fields.role ?? null,
      message: fields.message ?? null,
      pageUrl: c ? canonicalFor(c) : siteOrigin(),
      utm: (b.utm as Record<string, string>) ?? {},
      crmProvider: 'builtin',
      crmId: null,
      crmStatus: 'synced',
      crmError: null,
    }
    db.leads.push(l)
    audit(db, cid, 'system', 'lead.created', { company: l.company })
    return ok({ leadId: l.id })
  }

  // ---- everything below needs a session
  if (!role) return fail(401, 'Choose a role to continue.')

  if (head === 'overview' && method === 'GET') return ok(overview(db))
  if (head === 'leads' && method === 'GET') {
    return ok({ leads: [...db.leads].sort((a, b2) => b2.createdAt.localeCompare(a.createdAt)) })
  }

  if (head === 'claims' && id && method === 'PATCH') {
    const denied = requireRole(db, ['reviewer'], 'review claims')
    if (denied) return denied
    const v = db.versions.find((x) => x.claims.some((c) => c.id === id))
    const claim = v?.claims.find((c) => c.id === id)
    if (!v || !claim) return fail(404, 'Claim not found.')
    const status = b.status as Claim['status']
    const note = typeof b.note === 'string' ? b.note.trim() : ''
    if (status === 'rejected' && !note)
      return fail(400, 'Add a note saying why.', { note: 'Add a note saying why.' })
    if (v.state === 'approved')
      return fail(409, 'This version is approved. Edit it to start a new version.')
    const before = claim.status
    claim.status = status
    claim.note = note || null
    claim.reviewedBy = actor
    claim.reviewedAt = iso(Date.now())
    if (status === 'rejected' && before !== 'rejected')
      v.page = removeClaimFromPage(v.page, claim, v.claims)
    const c = db.campaigns.find((x) => x.id === v.campaignId)!
    c.updatedAt = iso(Date.now())
    audit(db, c.id, actor, `claim.${status}`, {
      claim: claim.text,
      note: note || undefined,
      version: v.number,
    })
    return ok(withClaims(v))
  }

  if (head === 'versions' && id) {
    const { v, c } = currentOf(db, id)
    if (!v || !c) return fail(404, 'Version not found.')
    if (method === 'PATCH') {
      const denied = requireRole(db, ['marketer'], 'edit the page')
      if (denied) return denied
      const target = forkIfApproved(db, v, c)
      if (Array.isArray(body)) {
        for (const edit of body as { blockKey: string; field: string; value: unknown }[]) {
          const bi = target.page.blocks.findIndex((x) => x._key === edit.blockKey)
          if (bi < 0) continue
          target.page.blocks[bi] = setPath(target.page.blocks[bi]!, edit.field, edit.value)
          for (const cl of target.claims) {
            if (
              cl.blockKey === edit.blockKey &&
              cl.field === edit.field &&
              cl.status !== 'rejected'
            ) {
              const still =
                typeof edit.value === 'string' &&
                edit.value.toLowerCase().includes(cl.text.toLowerCase())
              cl.status = 'needs_review'
              cl.validator = {
                ok: false,
                reasons: [
                  still
                    ? 'The field was edited; check the claim again.'
                    : 'The claim text changed in an edit.',
                ],
              }
            }
          }
        }
        audit(db, c.id, actor, 'version.edited', {
          version: target.number,
          fields: (body as unknown[]).length,
        })
      } else if (b.cta) {
        target.cta = b.cta as CtaConfig
        audit(db, c.id, actor, 'cta.changed', { kind: target.cta.kind, label: target.cta.label })
      } else if (b.seo) {
        target.seo = { ...target.seo, ...(b.seo as Partial<SeoConfig>) }
        audit(db, c.id, actor, 'seo.changed', {})
      }
      if (target.state === 'in_review' && Array.isArray(body)) target.state = 'draft'
      c.updatedAt = iso(Date.now())
      return ok(withClaims(target))
    }
    if (method === 'POST' && sub === 'submit') {
      const denied = requireRole(db, ['marketer'], 'submit for review')
      if (denied) return denied
      v.state = 'in_review'
      c.status = 'in_review'
      c.reviewReadyAt = c.reviewReadyAt ?? iso(Date.now())
      audit(db, c.id, actor, 'version.submitted', { version: v.number })
      return ok(withClaims(v))
    }
    if (method === 'POST' && sub === 'approve') {
      const denied = requireRole(db, ['reviewer'], 'approve a version')
      if (denied) return denied
      const blockers = computeBlockers(v)
      if (blockers.length) return fail(409, `Cannot approve yet: ${blockers.join('; ')}.`)
      v.state = 'approved'
      v.approvedBy = actor
      v.approvedAt = iso(Date.now())
      if (!['published', 'paused'].includes(c.status)) c.status = 'approved'
      audit(db, c.id, actor, 'version.approved', { version: v.number, note: b.note || undefined })
      return ok(withClaims(v))
    }
    if (method === 'POST' && sub === 'request-changes') {
      const denied = requireRole(db, ['reviewer'], 'send a version back')
      if (denied) return denied
      if (!String(b.note ?? '').trim())
        return fail(400, 'Say what needs to change.', { note: 'Say what needs to change.' })
      v.state = 'changes_requested'
      audit(db, c.id, actor, 'version.changes_requested', { version: v.number, note: b.note })
      return ok(withClaims(v))
    }
  }

  if (head === 'campaigns') {
    if (!id) {
      if (method === 'GET') {
        const list = db.campaigns
          .filter((c) => c.status !== 'archived')
          .sort((a, b2) => b2.updatedAt.localeCompare(a.updatedAt))
          .map((c) => {
            const cur = db.versions.find((v) => v.id === c.currentVersionId)
            const eng = summarizeEngagement(db, c.id)
            return {
              ...structuredClone(c),
              accountName:
                c.type === 'solutions'
                  ? null
                  : (db.accounts.find((a) => a.id === c.accountId)?.name ?? null),
              claimsNeedingReview:
                cur?.claims.filter((x) => x.status === 'needs_review').length ?? 0,
              hot: eng.hot,
            }
          })
        return ok({ campaigns: list })
      }
      if (method === 'POST') {
        const denied = requireRole(db, ['marketer', 'sales'], 'start a brief')
        if (denied) return denied
        const errs = validateBrief(b as Partial<AccountBrief>)
        if (Object.keys(errs).length) return fail(400, 'Check the highlighted fields.', errs)
        const c = createFromBrief(db, b as unknown as AccountBrief, 'brief')
        return ok({ campaignId: c.id }, 201)
      }
    }
    const c = db.campaigns.find((x) => x.id === id)
    if (!c) return fail(404, 'Campaign not found.')
    if (!sub && method === 'GET') return ok(campaignDetail(db, c))
    if (sub === 'engagement' && method === 'GET') return ok(summarizeEngagement(db, c.id))
    if (sub === 'audit' && method === 'GET') {
      return ok({
        entries: db.audit
          .filter((a) => a.campaignId === c.id)
          .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt) || b2.id - a.id),
      })
    }
    if (sub === 'sources' && method === 'POST') {
      const denied = requireRole(db, ['marketer'], 'gather sources')
      if (denied) return denied
      const account = db.accounts.find((a) => a.id === c.accountId)
      if (!account) return fail(400, 'Solutions pages use Hoverline facts only.')
      db.facts = db.facts.filter((f) => f.accountId !== account.id)
      db.sources = db.sources.filter((s) => s.accountId !== account.id)
      const seed = prospectFor(account.url)
      if (seed) addProspectSources(db, account, seed, Date.now())
      else
        db.sources.push({
          id: nextId(db, 'src'),
          accountId: account.id,
          url: account.url,
          title: null,
          fetchedAt: iso(Date.now()),
          status: 'failed',
          detail:
            'Fixture mode only has pages for the fictional prospects. Try the Northstar example brief.',
        })
      audit(db, c.id, actor, 'sources.fetched', {
        pages: db.sources.filter((s) => s.accountId === account.id).length,
      })
      c.updatedAt = iso(Date.now())
      return ok({
        sources: db.sources.filter((s) => s.accountId === account.id),
        facts: db.facts.filter((f) => f.accountId === account.id),
      })
    }
    if (sub === 'facts' && method === 'PATCH') {
      const denied = requireRole(db, ['marketer'], 'change sources')
      if (denied) return denied
      for (const ch of (body as { factId: string; included: boolean }[]) ?? []) {
        const f = db.facts.find((x) => x.id === ch.factId)
        if (f) f.included = ch.included
      }
      audit(db, c.id, actor, 'facts.updated', { changes: (body as unknown[])?.length ?? 0 })
      return ok({ facts: db.facts.filter((f) => f.accountId === c.accountId) })
    }
    if (sub === 'draft' && method === 'POST') {
      const denied = requireRole(db, ['marketer'], 'generate a draft')
      if (denied) return denied
      if (c.status === 'generating') return fail(409, 'A draft is already being written.')
      c.status = 'generating'
      c.updatedAt = iso(Date.now())
      db.generating[c.id] = Date.now() + 5200
      audit(db, c.id, actor, 'draft.requested', {})
      return ok({ versionId: 'pending' }, 202)
    }
    if (sub === 'publish' && method === 'POST') {
      const denied = requireRole(db, ['marketer'], 'publish')
      if (denied) return denied
      const v = db.versions.find((x) => x.id === b.versionId && x.campaignId === c.id)
      if (!v) return fail(404, 'Version not found.')
      if (v.state !== 'approved') return fail(409, 'Only an approved version can be published.')
      if (computeBlockers(v).length) return fail(409, 'This version still has publish blockers.')
      c.status = 'published'
      c.publishedVersionId = v.id
      c.publishedAt = iso(Date.now())
      if (typeof b.expiresAt === 'string' && b.expiresAt) c.expiresAt = b.expiresAt
      c.noindex = v.seo.noindex
      c.updatedAt = iso(Date.now())
      audit(db, c.id, actor, 'campaign.published', { version: v.number })
      return ok({ liveUrl: canonicalFor(c) })
    }
    if ((sub === 'pause' || sub === 'resume') && method === 'POST') {
      const denied = requireRole(db, ['marketer'], `${sub} a page`)
      if (denied) return denied
      c.status = sub === 'pause' ? 'paused' : 'published'
      c.updatedAt = iso(Date.now())
      audit(db, c.id, actor, `campaign.${sub === 'pause' ? 'paused' : 'resumed'}`, {})
      return ok(structuredClone(c))
    }
    if (sub === 'rollback' && method === 'POST') {
      const denied = requireRole(db, ['marketer'], 'roll back')
      if (denied) return denied
      const v = db.versions.find((x) => x.id === b.versionId && x.campaignId === c.id)
      if (!v || v.state !== 'approved')
        return fail(409, 'Only an approved version can be republished.')
      c.publishedVersionId = v.id
      c.currentVersionId = v.id
      c.status = 'published'
      c.publishedAt = iso(Date.now())
      c.updatedAt = iso(Date.now())
      audit(db, c.id, actor, 'campaign.rolled_back', { version: v.number })
      return ok({ liveUrl: canonicalFor(c) })
    }
    if (sub === 'duplicate' && method === 'POST') {
      const denied = requireRole(db, ['marketer'], 'duplicate a page')
      if (denied) return denied
      const brief = b.brief as AccountBrief
      const errs = validateBrief(brief ?? {})
      if (Object.keys(errs).length) return fail(400, 'Check the highlighted fields.', errs)
      const copy = createFromBrief(db, brief, 'duplicate')
      const src = db.versions.find((v) => v.id === c.currentVersionId)
      if (src) {
        const vid = nextId(db, 'ver')
        const dup: StoredVersion = {
          ...structuredClone(src),
          id: vid,
          campaignId: copy.id,
          number: 1,
          createdAt: iso(Date.now()),
          createdBy: actor,
          origin: 'duplicate',
          state: 'draft',
          approvedBy: null,
          approvedAt: null,
          seo: { ...src.seo, canonicalUrl: canonicalFor(copy) },
          claims: src.claims
            .filter((cl) => cl.status !== 'rejected')
            .map((cl) => ({
              ...structuredClone(cl),
              id: nextId(db, 'clm'),
              versionId: vid,
              ...(cl.kind === 'account_fact'
                ? {
                    status: 'needs_review' as const,
                    sources: [],
                    validator: {
                      ok: false,
                      reasons: ['Account facts were cleared when the page was duplicated.'],
                    },
                  }
                : {}),
            })),
        }
        db.versions.push(dup)
        copy.currentVersionId = vid
        copy.status = 'in_review'
      }
      return ok({ campaignId: copy.id }, 201)
    }
  }

  return fail(404, `No fixture for ${method} ${url.pathname}`)
}

function setPath(block: Block, path: string, value: unknown): Block {
  const segs = path.split('.').flatMap((seg) => {
    const m = /^(\w+)(?:\[(\d+)\])?$/.exec(seg)
    if (!m) return []
    return m[2] !== undefined ? [m[1]!, Number(m[2])] : [m[1]!]
  })
  const set = (obj: unknown, i: number): unknown => {
    if (i === segs.length) return value
    const key = segs[i]!
    if (typeof key === 'number') {
      const arr = Array.isArray(obj) ? [...obj] : []
      arr[key] = set(arr[key], i + 1)
      return arr
    }
    const o = obj && typeof obj === 'object' ? { ...(obj as Record<string, unknown>) } : {}
    o[key] = set(o[key], i + 1)
    return o
  }
  return set(block, 0) as Block
}

// ---------------------------------------------------------------------------
// Published pages for the public route stub
// ---------------------------------------------------------------------------

let serverDb: FixtureDb | null = null

/** A server-side seeded store, created once per process (public route stub only). */
export function serverFixtureDb(): FixtureDb {
  if (!serverDb) {
    serverDb = seedDb(Date.now(), { northstar: true })
    // The stub serves Northstar as if the demo script had already published it.
    const n = serverDb.campaigns.find((c) => c.id === NORTHSTAR_ID)!
    const v = serverDb.versions.find((x) => x.id === n.currentVersionId)!
    for (const cl of v.claims) {
      if (cl.status !== 'needs_review') continue
      if (cl.text.includes('40%')) {
        cl.status = 'rejected'
        v.page = removeClaimFromPage(v.page, cl, v.claims)
      } else cl.status = 'supported'
    }
    v.state = 'approved'
    n.status = 'published'
    n.publishedVersionId = v.id
    n.publishedAt = new Date().toISOString()
  }
  return serverDb
}

export function accountNameFor(db: FixtureDb, c: Campaign): string | null {
  if (c.type === 'solutions') return null
  return db.accounts.find((a) => a.id === c.accountId)?.name ?? null
}
