import 'server-only'
import {
  FakeLlm,
  FAKE_MODEL,
  UNSUPPORTED_CLAIM_PHRASE,
  simulateSelectFacts,
  splitSentences,
} from '@pageforge/agents'
import { facts } from '@pageforge/content'
import { sha256 } from './crypto'
import { fictionalText, halvorsen, northstar, type FictionalSite } from './fictional-data'
import { getAbmConfig } from './config'
import { absolute, publicPath } from './paths'
import { getAbmRuntime } from './runtime'
import {
  approveVersion,
  createCampaign,
  loadCampaign,
  publish,
  reviewClaim,
  startDraft,
  type Actor,
} from './service'
import type { NewEvent } from './store'
import type { AccountBrief, Campaign, EventType } from './types'

/**
 * Demo workspace seed (idempotent): when the demo workspace has no
 * campaigns, create
 *  - Northstar Port Authority: published private demo page (the 40% claim rejected),
 *  - Halvorsen Solar Partners: campaign page in review (the 40% claim needs review),
 *  - a published generic /solutions/ports page,
 * plus ~200 events, 6 leads and 3 meetings over 21 days. Every seeded
 * event, lead and audit row is flagged illustrative so the UI can say so.
 * Old demo rows (> 7 days) are purged lazily, at most once an hour.
 */
const DAY = 86_400_000
const marketer: Actor = { workspace: 'demo', role: 'marketer' }
const reviewer: Actor = { workspace: 'demo', role: 'reviewer' }

const g = globalThis as typeof globalThis & {
  __pfAbmSeed?: Promise<SeedResult>
  __pfAbmPurgedAt?: number
}

export interface SeedResult {
  seeded: boolean
  campaigns: string[]
}

export async function ensureDemoSeed(): Promise<SeedResult> {
  if (g.__pfAbmSeed) return g.__pfAbmSeed
  g.__pfAbmSeed = (async () => {
    const { store, now } = getAbmRuntime()
    const t = now().getTime()
    if (!g.__pfAbmPurgedAt || t - g.__pfAbmPurgedAt > 60 * 60 * 1000) {
      g.__pfAbmPurgedAt = t
      await store.purgeDemo(new Date(t - 7 * DAY))
    }
    const existing = await store.listCampaigns('demo', { since: new Date(t - 7 * DAY) })
    if (existing.length) return { seeded: false, campaigns: existing.map((c) => c.id) }
    return seedDemo()
  })()
  try {
    return await g.__pfAbmSeed
  } finally {
    g.__pfAbmSeed = undefined
  }
}

/** Reset the purge clock (tests). */
export function resetSeedState() {
  g.__pfAbmSeed = undefined
  g.__pfAbmPurgedAt = undefined
}

function siteUrlFor(site: FictionalSite, path = '') {
  return absolute(getAbmConfig().siteUrl, `/fictional/${site.slug}${path ? `/${path}` : ''}`)
}

/** Sources as the live fetcher would store them, built from the fictional site content. */
async function seedSources(accountId: string, site: FictionalSite, fetchedAt: string) {
  const { store } = getAbmRuntime()
  const pages = site.pages.map((p) => ({
    page: p,
    sentences: fictionalText(p).flatMap(splitSentences),
  }))
  const flat = pages.flatMap((p, i) => p.sentences.map((s) => ({ page: i, text: s })))
  const picked = simulateSelectFacts(
    flat.map((f) => f.text),
    14,
  ).facts
  return store.replaceSources(
    accountId,
    pages.map((p, i) => ({
      source: {
        url: siteUrlFor(site, p.page.path),
        title: p.page.path ? `${p.page.title} | ${site.name}` : site.name,
        fetchedAt,
        status: 'ok' as const,
        detail: null,
        contentHash: sha256(p.sentences.join('\n')),
      },
      facts: picked
        .filter((f) => flat[f.index]!.page === i)
        .map((f) => ({ quote: flat[f.index]!.text, category: f.category, included: true })),
    })),
  )
}

async function draftAndReview(
  campaign: Campaign,
  opts: { rejectUnsupported: boolean; approve: boolean; publish: boolean },
) {
  const { store } = getAbmRuntime()
  const llm = { llm: new FakeLlm(facts), simulated: true, models: [FAKE_MODEL] }
  const { versionId } = await startDraft(marketer, campaign.id, { inline: true, llm })
  const claims = await store.listClaims(versionId)
  const unsupported = claims.find((c) => c.text.includes(UNSUPPORTED_CLAIM_PHRASE))
  if (opts.rejectUnsupported && unsupported) {
    await reviewClaim(reviewer, unsupported.id, {
      status: 'rejected',
      note: 'No Hoverline fact supports a 40% staffing saving. Removed.',
    })
  }
  if (opts.approve) await approveVersion(reviewer, versionId, 'Sources check out.')
  if (opts.publish) await publish(marketer, campaign.id, versionId)
  return versionId
}

/** Small deterministic PRNG so the seed is the same on every instance. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface VisitPlan {
  campaign: Campaign
  pageKind: 'account' | 'generic'
  visitors: number
  rand: () => number
}

function plannedEvents(p: VisitPlan, now: number): NewEvent[] {
  const out: NewEvent[] = []
  const path = (publicPath(p.campaign) ?? '/').replace(/-[a-z2-9]{12}$/, '-…')
  const channels = ['email', 'linkedin', 'sales-sequence'] as const
  for (let v = 0; v < p.visitors; v++) {
    const visitorId = `seed${p.pageKind[0]}${String(v).padStart(3, '0')}${Math.floor(p.rand() * 1e6).toString(36)}`
    const source = channels[Math.floor(p.rand() * channels.length)]!
    const utm = {
      source,
      medium: source === 'linkedin' ? 'social' : source === 'email' ? 'email' : 'outbound',
      campaign: p.campaign.utmCampaign,
    }
    const visits = p.rand() < 0.3 ? 2 : 1
    for (let visit = 0; visit < visits; visit++) {
      const at = now - Math.floor(p.rand() * 21 * DAY) - 60 * 60 * 1000
      const push = (
        type: EventType,
        offsetMs: number,
        props: Record<string, string | number | boolean> = {},
      ) =>
        out.push({
          campaignId: p.campaign.id,
          versionId: p.campaign.publishedVersionId,
          pageKind: p.pageKind,
          path,
          visitorId,
          type,
          props: { ...props, illustrative: true },
          utm,
          createdAt: new Date(at + offsetMs).toISOString(),
        })
      push('page_view', 0, { referrer: source === 'linkedin' ? 'www.linkedin.com' : '' })
      const depth = p.rand()
      if (depth > 0.35) push('scroll_depth', 20_000, { depth: 25 })
      if (depth > 0.55) push('scroll_depth', 45_000, { depth: 50 })
      if (depth > 0.8 && p.pageKind === 'account') push('scroll_depth', 70_000, { depth: 75 })
      if (depth > 0.92) push('cta_click', 90_000, { label: 'Book a demo call', from: 'hero' })
    }
  }
  return out
}

const LEADS = [
  {
    name: 'Asha Rao',
    role: 'Head of Security',
    domain: 'northstar-port.example',
    company: 'Northstar Port Authority',
  },
  {
    name: 'Tomas Lindqvist',
    role: 'Terminal operations manager',
    domain: 'northstar-port.example',
    company: 'Northstar Port Authority',
  },
  {
    name: 'Grace Okafor',
    role: 'Port facility security officer',
    domain: 'northstar-port.example',
    company: 'Northstar Port Authority',
  },
  {
    name: 'Daniel Mercer',
    role: 'Engineering manager, cranes',
    domain: 'northstar-port.example',
    company: 'Northstar Port Authority',
  },
  {
    name: 'Mei Tanaka',
    role: 'Security manager',
    domain: 'harbourline.example',
    company: 'Harbourline Terminals',
  },
  {
    name: 'Luis Ortega',
    role: 'Operations director',
    domain: 'baywater-ports.example',
    company: 'Baywater Ports',
  },
]

export async function seedDemo(): Promise<SeedResult> {
  const { store, now } = getAbmRuntime()
  const t = now().getTime()
  const base = getAbmConfig().siteUrl
  const rand = prng(20261024)

  // 1. Northstar: private demo page, published.
  const northstarBrief: AccountBrief = {
    companyName: northstar.name,
    companyUrl: `${base}/fictional/${northstar.slug}`,
    industry: 'ports',
    siteCount: 4,
    campaignType: 'demo',
    goal: 'book-meeting',
    painPoints: ['night-time perimeter patrols', 'crane inspections', 'berth security after hours'],
    targetRole: 'Head of Security',
    sourceChannel: 'sales-sequence',
    salesNotes: 'Illustrative seed account. Board approved a perimeter monitoring pilot for 2027.',
  }
  const ns = await createCampaign(marketer, northstarBrief)
  await seedSources(ns.accountId!, northstar, new Date(t - 22 * DAY).toISOString())
  await draftAndReview(ns, { rejectUnsupported: true, approve: true, publish: true })

  // 2. Halvorsen: campaign page waiting for review.
  const hv = await createCampaign(marketer, {
    companyName: halvorsen.name,
    companyUrl: `${base}/fictional/${halvorsen.slug}`,
    industry: 'solar',
    siteCount: 6,
    campaignType: 'campaign',
    goal: 'download-report',
    painPoints: ['annual handheld thermal surveys', 'soiling at inland sites', 'inverter downtime'],
    targetRole: 'Head of Asset Management',
    sourceChannel: 'email',
  })
  await seedSources(hv.accountId!, halvorsen, new Date(t - 2 * DAY).toISOString())
  await draftAndReview(hv, { rejectUnsupported: false, approve: false, publish: false })

  // 3. Generic baseline: /solutions/ports.
  const sol = await createCampaign(marketer, {
    companyName: 'Ports solutions page',
    companyUrl: `${base}/solutions/ports`,
    industry: 'ports',
    campaignType: 'solutions',
    goal: 'book-meeting',
    painPoints: [],
    targetRole: 'Head of Security',
    sourceChannel: 'other',
  })
  await draftAndReview(sol, { rejectUnsupported: true, approve: true, publish: true })

  // Backdate lifecycle times so the review metrics read like real use.
  await store.updateCampaign(ns.id, {
    briefAt: new Date(t - 22 * DAY).toISOString(),
    reviewReadyAt: new Date(t - 22 * DAY + 9 * 60_000).toISOString(),
    publishedAt: new Date(t - 21 * DAY).toISOString(),
  })
  await store.updateCampaign(hv.id, {
    briefAt: new Date(t - 2 * DAY).toISOString(),
    reviewReadyAt: new Date(t - 2 * DAY + 11 * 60_000).toISOString(),
  })
  await store.updateCampaign(sol.id, {
    briefAt: new Date(t - 23 * DAY).toISOString(),
    reviewReadyAt: new Date(t - 23 * DAY + 7 * 60_000).toISOString(),
    publishedAt: new Date(t - 21 * DAY).toISOString(),
  })

  // 4. Illustrative engagement: ~200 events, 6 leads, 3 meetings over 21 days.
  const nsLive = await loadCampaign(marketer, ns.id)
  const solLive = await loadCampaign(marketer, sol.id)
  const accountEvents = plannedEvents(
    { campaign: nsLive, pageKind: 'account', visitors: 30, rand },
    t,
  )
  const genericEvents = plannedEvents(
    { campaign: solLive, pageKind: 'generic', visitors: 40, rand },
    t,
  )
  const events = [...accountEvents, ...genericEvents]

  const leadIds: { id: string; campaign: Campaign; visitorId: string; at: number }[] = []
  for (const [i, person] of LEADS.entries()) {
    const campaign = i < 4 ? nsLive : solLive
    const pool = (i < 4 ? accountEvents : genericEvents).filter((e) => e.type === 'page_view')
    const visit = pool[(i * 7) % pool.length]!
    const at = Date.parse(visit.createdAt!) + 3 * 60_000
    const lead = await store.createLead({
      campaignId: campaign.id,
      accountId: campaign.accountId,
      visitorId: visit.visitorId,
      name: person.name,
      email: `${person.name.split(' ')[0]!.toLowerCase()}@${person.domain}`,
      company: person.company,
      role: person.role,
      message: null,
      pageUrl: absolute(base, publicPath(campaign) ?? '/'),
      utm: { ...(visit.utm as Record<string, string>) },
      crmProvider: 'builtin',
      crmId: null,
      crmStatus: 'synced',
      crmError: null,
      illustrative: true,
      createdAt: new Date(at).toISOString(),
    })
    leadIds.push({ id: lead.id, campaign, visitorId: visit.visitorId, at })
    await store.audit({
      workspace: 'demo',
      campaignId: campaign.id,
      actorRole: 'system',
      action: 'lead.created',
      detail: { company: person.company, illustrative: true },
      createdAt: new Date(at).toISOString(),
    })
    events.push(
      {
        ...visit,
        type: 'form_start',
        props: { form: 'lead', illustrative: true },
        createdAt: new Date(at - 60_000).toISOString(),
      },
      {
        ...visit,
        type: 'form_submit',
        props: { form: 'lead', illustrative: true },
        createdAt: new Date(at).toISOString(),
      },
    )
  }
  for (const [i, l] of [leadIds[0]!, leadIds[2]!, leadIds[4]!].entries()) {
    // Slots on past working days at 10:30 UTC (16:00 in Kolkata), spaced apart.
    const d = new Date(l.at + DAY * (i + 1))
    d.setUTCHours(10, 30, 0, 0)
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setTime(d.getTime() + DAY)
    const meeting = await store.createMeeting({
      campaignId: l.campaign.id,
      leadId: l.id,
      slotStart: d.toISOString(),
      timezone: i === 1 ? 'America/New_York' : 'Asia/Kolkata',
      createdAt: new Date(l.at + 5 * 60_000).toISOString(),
    })
    if (meeting)
      await store.audit({
        workspace: 'demo',
        campaignId: l.campaign.id,
        actorRole: 'system',
        action: 'meeting.booked',
        detail: { slot: meeting.slotStart, illustrative: true },
        createdAt: meeting.createdAt,
      })
    events.push({
      campaignId: l.campaign.id,
      versionId: l.campaign.publishedVersionId,
      pageKind: l.campaign.type === 'solutions' ? 'generic' : 'account',
      path: (publicPath(l.campaign) ?? '/').replace(/-[a-z2-9]{12}$/, '-…'),
      visitorId: l.visitorId,
      type: 'meeting_booked',
      props: {
        slot: d.toISOString(),
        timezone: i === 1 ? 'America/New_York' : 'Asia/Kolkata',
        illustrative: true,
      },
      utm: {},
      createdAt: new Date(l.at + 5 * 60_000).toISOString(),
    })
  }
  await store.addEvents(events)

  for (const c of [ns, hv, sol]) {
    await store.audit({
      workspace: 'demo',
      campaignId: c.id,
      actorRole: 'system',
      action: 'seed',
      detail: { illustrative: true },
    })
  }
  return { seeded: true, campaigns: [ns.id, hv.id, sol.id] }
}
