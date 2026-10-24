import 'server-only'
import {
  draftAccountPage,
  fieldRoot,
  getAt,
  parsePath,
  removeRejectedClaims,
  selectFacts,
  setAt,
  copyEntries,
  INDUSTRY_SITE_TYPE,
  type AbmBrief,
  type EnvLlm,
} from '@pageforge/agents'
import { blockSchema, pageSchema, type Page } from '@pageforge/blocks'
import { facts as brandFacts } from '@pageforge/content'
import { safeErrorMessage } from '@/lib/env'
import { analyticsFor } from './service-analytics'
import {
  accountFactsFrom,
  asNewClaim,
  claimsAfterEdit,
  productFactsFor,
  publishBlockers,
  revalidate,
} from './claims-engine'
import { getAbmConfig } from './config'
import { randomToken, sha256 } from './crypto'
import { extractPage } from './extract'
import { SourceFetchError, safeFetch } from './fetch'
import { AbmError } from './http'
import { parseRobots, robotsAllows } from './robots'
import { getAbmRuntime } from './runtime'
import { INDUSTRY_LABEL, absolute, publicPath, slugify, trackingLinks } from './paths'
import type { NewClaim, NewSource, NewSourceFact, SourceRecord } from './store'
import type {
  Account,
  AccountBrief,
  ActorRole,
  AuditEntry,
  Campaign,
  CampaignDetail,
  CampaignStatus,
  Claim,
  CtaConfig,
  Role,
  SeoConfig,
  SourceFact,
  Version,
  VersionWithClaims,
  Workspace,
} from './types'

/**
 * ABM services: every state change of the campaign lifecycle (spec §2),
 * with workspace isolation, role checks and an audit entry per action.
 * Route handlers parse and authorise the request, then call these.
 */
export interface Actor {
  workspace: Workspace
  role: Role | 'system'
}

const DEFAULT_EXPIRY_DAYS = 60
const MAX_SOURCES = 4
const SIM_DRAFT_MS = 1_500

const rt = () => getAbmRuntime()
const nowIso = () => rt().now().toISOString()

function allow(actor: Actor, roles: Role[]) {
  if (actor.role === 'system' || actor.role === 'admin') return
  if (!roles.includes(actor.role))
    throw new AbmError(
      403,
      `This action needs the ${roles.join(' or ')} role. Switch role and try again.`,
    )
}

async function audit(
  actor: Actor,
  campaignId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await rt().store.audit({
    workspace: actor.workspace,
    campaignId,
    actorRole: actor.role as ActorRole,
    action,
    detail,
    createdAt: nowIso(),
  })
}

/** Load a campaign in the actor's workspace; expire it lazily when its date has passed. */
export async function loadCampaign(actor: Actor | null, id: string): Promise<Campaign> {
  const c = await rt().store.getCampaign(id)
  if (!c || (actor && c.workspace !== actor.workspace))
    throw new AbmError(404, 'Campaign not found.')
  return expireIfDue(await recoverStaleDraft(c))
}

/** A draft still "generating" after this long was cut off (function timeout, deploy). */
export const STALE_DRAFT_MS = 6 * 60 * 1000

/**
 * Background drafts run after the response; if the platform stops that work
 * the campaign would stay "generating" for ever. Reset it so the marketer can
 * try again, and say so in the audit log.
 */
export async function recoverStaleDraft(c: Campaign): Promise<Campaign> {
  if (c.status !== 'generating') return c
  if (rt().now().getTime() - Date.parse(c.updatedAt) < STALE_DRAFT_MS) return c
  const { store } = rt()
  const stuck = c.currentVersionId ? await store.getVersion(c.currentVersionId) : null
  if (stuck && stuck.origin === 'ai_draft' && stuck.state === 'draft')
    await store.deleteVersion(stuck.id).catch(() => undefined)
  const remaining = await store.listVersions(c.id)
  const next = await store.updateCampaign(c.id, {
    status: 'draft',
    currentVersionId: remaining.at(-1)?.id ?? null,
  })
  await audit({ workspace: c.workspace, role: 'system' }, c.id, 'draft.failed', {
    error: 'The draft did not finish in time. Generate it again.',
  }).catch(() => undefined)
  return next
}

/** One log line per model call chain, without prompts or secrets. */
function logLlm(step: string, llm: unknown, started: number) {
  const attempts = (
    llm as { lastAttempts?: { model: string; ok: boolean; kind?: string; ms?: number }[] }
  ).lastAttempts
  console.info(
    '[abm] llm',
    JSON.stringify({
      step,
      ms: rt().now().getTime() - started,
      attempts: attempts?.map((a) => ({ model: a.model, ok: a.ok, kind: a.kind, ms: a.ms })),
    }),
  )
}

export async function expireIfDue(c: Campaign): Promise<Campaign> {
  if (
    (c.status === 'published' || c.status === 'paused') &&
    c.expiresAt &&
    Date.parse(c.expiresAt) <= rt().now().getTime()
  ) {
    const next = await rt().store.updateCampaign(c.id, { status: 'expired' })
    await audit({ workspace: c.workspace, role: 'system' }, c.id, 'campaign.expired', {
      expiresAt: c.expiresAt,
    })
    return next
  }
  return c
}

async function loadVersion(actor: Actor, versionId: string) {
  const version = await rt().store.getVersion(versionId)
  if (!version) throw new AbmError(404, 'Version not found.')
  const campaign = await loadCampaign(actor, version.campaignId)
  return { version, campaign }
}

export async function withClaims(version: Version, claims?: Claim[]): Promise<VersionWithClaims> {
  const list = claims ?? (await rt().store.listClaims(version.id))
  return { ...version, claims: list, publishBlockers: publishBlockers(version.page, list) }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

async function uniqueSlug(type: Campaign['type'], base: string): Promise<string> {
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const taken = await rt().store.findCampaigns({ type, slug })
    if (!taken.some((c) => c.status !== 'archived')) return slug
  }
  return `${base}-${randomToken(4)}`
}

function defaultCta(goal: Campaign['goal']): CtaConfig {
  return goal === 'book-meeting'
    ? { label: 'Book a demo call', kind: 'calendar', formFields: ['role'] }
    : {
        label: goal === 'download-report' ? 'Get the sample report' : 'Request an event seat',
        kind: 'form',
        formFields: ['role'],
      }
}

/** Brief → account + campaign (status draft). Solutions pages have no account. */
export async function createCampaign(
  actor: Actor,
  brief: AccountBrief,
  opts: { createdAt?: string; duplicateOf?: string } = {},
): Promise<Campaign> {
  allow(actor, ['marketer'])
  const { store } = rt()
  const createdAt = opts.createdAt ?? nowIso()
  let account: Account | null = null
  let slug: string
  if (brief.campaignType === 'solutions') {
    slug = brief.industry
    const existing = await store.findCampaigns({
      type: 'solutions',
      slug,
      workspace: actor.workspace,
    })
    if (existing.some((c) => c.status !== 'archived'))
      throw new AbmError(
        409,
        `A solutions page for ${INDUSTRY_LABEL[brief.industry].label.toLowerCase()} already exists. Open it instead.`,
      )
  } else {
    account = await store.createAccount({
      workspace: actor.workspace,
      name: brief.companyName,
      url: brief.companyUrl,
      domain: domainOf(brief.companyUrl),
      industry: brief.industry,
      siteCount: brief.siteCount ?? null,
      targetRole: brief.targetRole,
      painPoints: brief.painPoints,
      salesNotes: brief.salesNotes ?? null,
      createdBy: actor.role as ActorRole,
      createdAt,
    })
    slug = await uniqueSlug(brief.campaignType, slugify(brief.companyName))
  }
  const days =
    brief.expiresInDays ?? (brief.campaignType === 'solutions' ? null : DEFAULT_EXPIRY_DAYS)
  const created = Date.parse(createdAt)
  const campaign = await store.createCampaign({
    workspace: actor.workspace,
    accountId: account?.id ?? null,
    type: brief.campaignType,
    industry: brief.industry,
    goal: brief.goal,
    sourceChannel: brief.sourceChannel,
    status: 'draft',
    slug,
    token: null,
    utmCampaign: `abm-${slug}`.slice(0, 80),
    expiresAt: days ? new Date(created + days * 86_400_000).toISOString() : null,
    noindex: brief.campaignType !== 'solutions',
    currentVersionId: null,
    publishedVersionId: null,
    publishedAt: null,
    briefAt: createdAt,
    reviewReadyAt: null,
    createdBy: actor.role as ActorRole,
    createdAt,
  })
  await audit(actor, campaign.id, opts.duplicateOf ? 'campaign.duplicated' : 'brief.created', {
    company: account?.name ?? `${INDUSTRY_LABEL[brief.industry].label} solutions page`,
    ...(opts.duplicateOf ? { from: opts.duplicateOf } : {}),
    type: brief.campaignType,
    industry: brief.industry,
    account: account?.name ?? null,
    targetRole: brief.targetRole,
    painPoints: brief.painPoints,
    expiresInDays: days,
  })
  return campaign
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listCampaigns(actor: Actor) {
  const { store } = rt()
  const since =
    actor.workspace === 'demo' ? new Date(rt().now().getTime() - 7 * 86_400_000) : undefined
  const campaigns = await Promise.all(
    (await store.listCampaigns(actor.workspace, { since })).map(expireIfDue),
  )
  const accountIds = [...new Set(campaigns.map((c) => c.accountId).filter(Boolean))] as string[]
  const accounts = new Map(
    (await Promise.all(accountIds.map((id) => store.getAccount(id))))
      .filter(Boolean)
      .map((a) => [a!.id, a!]),
  )
  const currentIds = campaigns.map((c) => c.currentVersionId).filter(Boolean) as string[]
  const claims = await store.listClaimsForVersions(currentIds)
  const hot = await analyticsFor(campaigns).hotByCampaign()
  return campaigns.map((c) => ({
    ...c,
    accountName: c.accountId ? (accounts.get(c.accountId)?.name ?? null) : null,
    claimsNeedingReview: claims.filter(
      (x) => x.versionId === c.currentVersionId && x.status === 'needs_review',
    ).length,
    hot: hot.get(c.id) ?? false,
  }))
}

export async function getCampaignDetail(actor: Actor, id: string): Promise<CampaignDetail> {
  const { store } = rt()
  const campaign = await loadCampaign(actor, id)
  const [account, versions, auditLog] = await Promise.all([
    campaign.accountId ? store.getAccount(campaign.accountId) : null,
    store.listVersions(campaign.id),
    store.listAudit(campaign.id),
  ])
  const [sources, facts] = account
    ? await Promise.all([store.listSources(account.id), store.listFacts(account.id)])
    : [[], []]
  const currentVersion = versions.find((v) => v.id === campaign.currentVersionId) ?? null
  const live = liveUrlOf(campaign)
  const lastFailure = auditLog.find((a) => a.action === 'draft.failed')
  const lastReady = auditLog.find(
    (a) => a.action === 'draft.generated' || a.action === 'draft.requested',
  )
  const lastError =
    lastFailure &&
    (!lastReady || Date.parse(lastFailure.createdAt) >= Date.parse(lastReady.createdAt))
      ? String(lastFailure.detail.error ?? 'The draft failed.')
      : null
  return {
    ...campaign,
    account,
    sources: sources.map(stripSource),
    facts,
    versions: versions.map((v) => ({
      id: v.id,
      number: v.number,
      createdAt: v.createdAt,
      origin: v.origin,
      state: v.state,
      createdBy: v.createdBy,
    })),
    current: currentVersion ? await withClaims(currentVersion) : null,
    liveUrl: live,
    trackingLinks: live ? trackingLinks(live, campaign) : [],
    lastError,
    illustrative: auditLog.some((a) => a.action === 'seed'),
  }
}

function stripSource(s: SourceRecord) {
  const { contentHash, ...rest } = s
  void contentHash
  return rest
}

export function liveUrlOf(c: Campaign): string | null {
  if (!c.publishedVersionId || (c.status !== 'published' && c.status !== 'paused')) return null
  const path = publicPath(c)
  return path ? absolute(getAbmConfig().siteUrl, path) : null
}

export async function listAudit(actor: Actor, id: string): Promise<AuditEntry[]> {
  await loadCampaign(actor, id)
  return rt().store.listAudit(id)
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/**
 * Fetch the company's public pages (home + up to 3 about/facilities/news
 * links, or the given URLs), respect robots.txt, extract sentences, and let
 * the model pick facts by sentence index (quotes stay verbatim).
 */
export async function gatherSources(actor: Actor, id: string, urls?: string[]) {
  allow(actor, ['marketer'])
  const { store } = rt()
  const campaign = await loadCampaign(actor, id)
  if (!campaign.accountId)
    throw new AbmError(
      409,
      'Solutions pages use Hoverline facts only; there is no account to read.',
    )
  const account = (await store.getAccount(campaign.accountId))!
  const config = getAbmConfig()
  const fetchOpts = { allowLoopback: config.allowLocalSources, deps: rt().fetchDeps }

  const robotsCache = new Map<string, ReturnType<typeof parseRobots> | 'unreadable'>()
  const robotsFor = async (u: URL) => {
    if (robotsCache.has(u.origin)) return robotsCache.get(u.origin)!
    let r: ReturnType<typeof parseRobots> | 'unreadable'
    try {
      r = parseRobots(
        (await safeFetch(`${u.origin}/robots.txt`, { ...fetchOpts, accept: 'text' })).body,
      )
    } catch (e) {
      // A missing robots.txt (4xx) allows everything; a blocked origin stays blocked below.
      r =
        e instanceof SourceFetchError && /HTTP 4\d\d/.test(e.message)
          ? parseRobots('')
          : e instanceof SourceFetchError && e.kind === 'blocked'
            ? parseRobots('')
            : 'unreadable'
    }
    robotsCache.set(u.origin, r)
    return r
  }

  type Page = { source: NewSource; sentences: string[] }
  const pages: Page[] = []
  const queue = (urls?.length ? urls : [account.url]).slice(0, MAX_SOURCES)
  const seen = new Set<string>()
  const discover = !urls?.length

  while (queue.length && pages.length < MAX_SOURCES) {
    const raw = queue.shift()!
    if (seen.has(raw)) continue
    seen.add(raw)
    const fetchedAt = nowIso()
    const base: Omit<NewSource, 'status' | 'detail'> = {
      url: raw,
      title: null,
      fetchedAt,
      contentHash: null,
    }
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      pages.push({
        source: { ...base, status: 'blocked', detail: 'Not a valid URL.' },
        sentences: [],
      })
      continue
    }
    const robots = await robotsFor(u)
    if (robots === 'unreadable') {
      pages.push({
        source: {
          ...base,
          status: 'robots_disallowed',
          detail: 'robots.txt could not be read, so the page was skipped.',
        },
        sentences: [],
      })
      continue
    }
    if (!robotsAllows(robots, `${u.pathname}${u.search}`)) {
      pages.push({
        source: {
          ...base,
          status: 'robots_disallowed',
          detail: 'robots.txt disallows this page for PageForgeBot; it was skipped.',
        },
        sentences: [],
      })
      continue
    }
    try {
      const res = await safeFetch(raw, fetchOpts)
      const page = extractPage(res.body, res.url)
      pages.push({
        source: {
          ...base,
          url: res.url,
          title: page.title?.slice(0, 200) ?? null,
          status: 'ok',
          detail: page.sentences.length ? null : 'No readable sentences on this page.',
          contentHash: sha256(page.sentences.join('\n')),
        },
        sentences: page.sentences,
      })
      if (discover && pages.length === 1)
        for (const l of page.links) if (!seen.has(l)) queue.push(l)
    } catch (e) {
      const err =
        e instanceof SourceFetchError ? e : new SourceFetchError('failed', safeErrorMessage(e, 200))
      pages.push({
        source: { ...base, status: err.kind, detail: safeErrorMessage(err, 300) },
        sentences: [],
      })
    }
  }

  // One selection call over every sentence, indexed globally.
  const flat: { page: number; text: string }[] = []
  pages.forEach((p, i) => p.sentences.forEach((s) => flat.push({ page: i, text: s })))
  const capped = flat.slice(0, 240)
  const { llm } = rt().llm()
  const selectStarted = rt().now().getTime()
  const selected = capped.length
    ? (
        await selectFacts(llm, {
          brief: {
            companyName: account.name,
            industry: campaign.industry,
            painPoints: account.painPoints,
            targetRole: account.targetRole ?? '',
          },
          sentences: capped.map((s) => s.text),
        }).finally(() => logLlm('select-facts', llm, selectStarted))
      ).facts
    : []
  const factsByPage = new Map<number, NewSourceFact[]>()
  for (const f of selected) {
    const s = capped[f.index]!
    if (!factsByPage.has(s.page)) factsByPage.set(s.page, [])
    factsByPage.get(s.page)!.push({ quote: s.text, category: f.category, included: true })
  }
  const result = await store.replaceSources(
    account.id,
    pages.map((p, i) => ({ source: p.source, facts: factsByPage.get(i) ?? [] })),
  )
  await audit(actor, campaign.id, 'sources.fetched', {
    pages: result.sources.length,
    sources: result.sources.map((s) => ({ url: s.url, status: s.status })),
    facts: result.facts.length,
  })
  return { sources: result.sources.map(stripSource), facts: result.facts }
}

export async function setFacts(
  actor: Actor,
  id: string,
  changes: { factId: string; included: boolean }[],
) {
  allow(actor, ['marketer'])
  const { store } = rt()
  const campaign = await loadCampaign(actor, id)
  if (!campaign.accountId) throw new AbmError(409, 'This campaign has no account facts.')
  for (const c of changes) {
    const f = await store.setFactIncluded(campaign.accountId, c.factId, c.included)
    if (!f) throw new AbmError(404, `Fact ${c.factId} not found on this account.`)
  }
  await audit(actor, campaign.id, 'facts.updated', { changes: changes.length, items: changes })
  return { facts: await store.listFacts(campaign.accountId) }
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

function briefOf(campaign: Campaign, account: Account | null): AbmBrief {
  return {
    companyName: account?.name ?? INDUSTRY_LABEL[campaign.industry].audience,
    industry: campaign.industry,
    siteCount: account?.siteCount ?? undefined,
    campaignType: campaign.type,
    goal: campaign.goal,
    painPoints: account?.painPoints ?? [],
    targetRole: account?.targetRole ?? 'operations lead',
    ...(account?.salesNotes ? { salesNotes: account.salesNotes } : {}),
  }
}

function placeholderPage(campaign: Campaign, name: string): Page {
  return {
    kind: 'landing',
    title: `Draft for ${name}`.slice(0, 90),
    slug: campaign.slug,
    seo: {
      title: 'Draft in progress',
      description: 'The draft is being generated.',
      noindex: true,
    },
    blocks: [
      {
        _key: 'b1',
        _type: 'hero',
        variant: 'statement',
        heading: 'Draft in progress',
        subheading: 'The page is being drafted from approved facts. This takes under a minute.',
        primaryCta: { label: 'Book a demo call', href: '#demo-form' },
        siteType: INDUSTRY_SITE_TYPE[campaign.industry],
      },
    ],
  }
}

function seoFor(campaign: Campaign, page: Page): SeoConfig {
  const path = publicPath(campaign) ?? publicPath({ ...campaign, token: 'pending' }) ?? '/'
  const canonicalUrl = absolute(getAbmConfig().siteUrl, path)
  return {
    title: page.seo.title,
    description: page.seo.description,
    noindex: campaign.noindex,
    canonicalUrl,
    ogImageUrl: absolute(getAbmConfig().siteUrl, `/api/abm/og/${campaign.id}`),
  }
}

/** Start an AI draft: creates a placeholder version now, fills it in the background. */
export async function startDraft(
  actor: Actor,
  id: string,
  opts: { inline?: boolean; llm?: EnvLlm } = {},
): Promise<{ versionId: string }> {
  allow(actor, ['marketer'])
  const { store, schedule } = rt()
  const campaign = await loadCampaign(actor, id)
  if (campaign.status === 'generating')
    throw new AbmError(409, 'A draft is already being generated.')
  if (['expired', 'archived'].includes(campaign.status))
    throw new AbmError(409, `This campaign is ${campaign.status}; duplicate it to start again.`)
  const account = campaign.accountId ? await store.getAccount(campaign.accountId) : null
  const versions = await store.listVersions(campaign.id)
  const env = opts.llm ?? rt().llm()
  const { simulated, models } = env
  const { version } = await store.createVersion(
    {
      campaignId: campaign.id,
      number: (versions.at(-1)?.number ?? 0) + 1,
      createdBy: actor.role as ActorRole,
      origin: 'ai_draft',
      state: 'draft',
      page: placeholderPage(campaign, account?.name ?? INDUSTRY_LABEL[campaign.industry].label),
      seo: seoFor(campaign, placeholderPage(campaign, '')),
      cta: defaultCta(campaign.goal),
      model: models.join(' → '),
      simulated,
      approvedBy: null,
      approvedAt: null,
    },
    [],
  )
  const previous = { status: campaign.status, currentVersionId: campaign.currentVersionId }
  await store.updateCampaign(campaign.id, {
    status: isLive(campaign.status) ? campaign.status : 'generating',
    currentVersionId: version.id,
  })
  await audit(actor, campaign.id, 'draft.requested', {
    version: version.number,
    versionId: version.id,
    model: simulated ? 'simulation' : models.join(' → '),
  })
  if (opts.inline)
    await runDraft(actor, campaign.id, version.id, previous, { llm: env, pace: false })
  else schedule(() => runDraft(actor, campaign.id, version.id, previous, { llm: env, pace: true }))
  return { versionId: version.id }
}

const isLive = (s: CampaignStatus) => s === 'published' || s === 'paused'

export async function runDraft(
  actor: Actor,
  campaignId: string,
  versionId: string,
  previous: { status: CampaignStatus; currentVersionId: string | null },
  opts: { llm?: EnvLlm; pace?: boolean } = {},
): Promise<void> {
  const { store } = rt()
  const started = rt().now().getTime()
  try {
    const campaign = (await store.getCampaign(campaignId))!
    const account = campaign.accountId ? await store.getAccount(campaign.accountId) : null
    const [sources, sourceFacts] = account
      ? await Promise.all([store.listSources(account.id), store.listFacts(account.id)])
      : [[], [] as SourceFact[]]
    const accountFacts = accountFactsFrom(sourceFacts, sources)
    const env = opts.llm ?? rt().llm()
    if (env.simulated && opts.pace !== false) await rt().sleep(SIM_DRAFT_MS)
    const draft = await draftAccountPage(env.llm, {
      brief: briefOf(campaign, account),
      productFacts: productFactsFor(campaign.industry),
      accountFacts,
      slug: campaign.slug,
      noindex: campaign.noindex,
      bannedPhrases: brandFacts.voice.bannedPhrases,
    }).finally(() => logLlm('draft', env.llm, started))
    const claims = revalidate({
      page: draft.page,
      claims: draft.claims.map((c) => ({
        blockKey: c.blockKey,
        field: c.field,
        text: c.text,
        kind: c.kind,
        sources: c.sources,
        status: 'needs_review',
        validator: {
          ok: false,
          reasons: c.unresolved?.map((u) => `Cites "${u}", which is not an approved fact.`) ?? [],
        },
        reviewedBy: null,
        reviewedAt: null,
        note: null,
        origin: 'draft',
      })),
      industry: campaign.industry,
      accountFacts,
      accountName: account?.name,
    })
    await store.updateVersion(versionId, {
      page: draft.page,
      seo: seoFor(campaign, draft.page),
      model: draft.model,
      simulated: env.simulated,
      state: 'in_review',
    })
    const saved = await store.replaceClaims(versionId, claims)
    const now = nowIso()
    const fresh = (await store.getCampaign(campaignId))!
    await store.updateCampaign(campaignId, {
      status: isLive(fresh.status) ? fresh.status : 'in_review',
      reviewReadyAt: fresh.reviewReadyAt ?? now,
    })
    await audit(actor, campaignId, 'draft.generated', {
      version: (await store.getVersion(versionId))?.number,
      versionId,
      model: env.simulated ? 'simulation' : draft.model,
      simulated: env.simulated,
      calls: draft.calls,
      claims: saved.length,
      needsReview: saved.filter((c) => c.status === 'needs_review').length,
      ms: rt().now().getTime() - started,
    })
  } catch (e) {
    const error = safeErrorMessage(e)
    await store.deleteVersion(versionId).catch(() => undefined)
    await store
      .updateCampaign(campaignId, {
        status: previous.status === 'generating' ? 'draft' : previous.status,
        currentVersionId: previous.currentVersionId,
      })
      .catch(() => undefined)
    await audit(actor, campaignId, 'draft.failed', { versionId, error }).catch(() => undefined)
  }
}

// ---------------------------------------------------------------------------
// Edit, submit, review, approve
// ---------------------------------------------------------------------------

export type VersionPatch =
  | { blockKey: string; field: string; value: string | boolean }[]
  | { cta: CtaConfig }
  | { seo: Partial<Pick<SeoConfig, 'title' | 'description' | 'noindex'>> }

async function editableCopy(actor: Actor, version: Version, campaign: Campaign) {
  if (campaign.currentVersionId !== version.id)
    throw new AbmError(409, 'Only the current version can be edited. Open the latest version.')
  if (campaign.status === 'generating') throw new AbmError(409, 'Wait for the draft to finish.')
  if (version.state !== 'approved')
    return {
      version,
      claims: await rt().store.listClaims(version.id),
      forked: false,
      from: null as number | null,
    }
  // Approved versions are frozen: an edit starts a new 'edit' version.
  const { store } = rt()
  const versions = await store.listVersions(campaign.id)
  const claims = await store.listClaims(version.id)
  const created = await store.createVersion(
    {
      campaignId: campaign.id,
      number: (versions.at(-1)?.number ?? version.number) + 1,
      createdBy: actor.role as ActorRole,
      origin: 'edit',
      state: 'draft',
      page: version.page,
      seo: version.seo,
      cta: version.cta,
      model: version.model,
      simulated: version.simulated,
      approvedBy: null,
      approvedAt: null,
    },
    claims.map(asNewClaim),
  )
  await store.updateCampaign(campaign.id, {
    currentVersionId: created.version.id,
    status: isLive(campaign.status) ? campaign.status : 'draft',
  })
  return { version: created.version, claims: created.claims, forked: true, from: version.number }
}

export async function editVersion(
  actor: Actor,
  versionId: string,
  patch: VersionPatch,
): Promise<VersionWithClaims> {
  allow(actor, ['marketer'])
  const { store } = rt()
  const loaded = await loadVersion(actor, versionId)
  const { campaign } = loaded
  const { version, claims, from } = await editableCopy(actor, loaded.version, campaign)
  const forkInfo = from === null ? {} : { fromVersion: from }
  const state = version.state === 'changes_requested' ? 'draft' : version.state

  if (!Array.isArray(patch)) {
    if ('cta' in patch) {
      const v = await store.updateVersion(version.id, { cta: patch.cta, state })
      await audit(actor, campaign.id, 'cta.changed', {
        version: v.number,
        label: patch.cta.label,
        kind: patch.cta.kind,
        ...forkInfo,
      })
      return withClaims(v, claims)
    }
    const seo = { ...version.seo, ...patch.seo }
    const page = {
      ...version.page,
      seo: { title: seo.title, description: seo.description, noindex: seo.noindex },
    }
    if (!pageSchema.shape.seo.safeParse(page.seo).success)
      throw new AbmError(422, 'The SEO title must be 1–60 characters and the description 1–160.')
    const v = await store.updateVersion(version.id, { seo, page, state })
    await audit(actor, campaign.id, 'seo.changed', {
      version: v.number,
      seo: patch.seo,
      ...forkInfo,
    })
    return withClaims(v, claims)
  }

  const page = structuredClone(version.page)
  for (const e of patch) {
    const block = page.blocks.find((b) => b._key === e.blockKey)
    if (!block) throw new AbmError(422, `Block ${e.blockKey} is not on this page.`)
    const parts = parsePath(e.field)
    if (parts[0] === '_key' || parts[0] === '_type')
      throw new AbmError(422, 'Block keys and types cannot be edited.')
    const current = getAt(block, parts)
    const optionalTop = current === undefined && parts.length === 1
    if (!optionalTop && typeof current !== typeof e.value)
      throw new AbmError(
        422,
        `${e.blockKey}.${e.field} is not an editable ${typeof e.value} field.`,
      )
    const value = typeof e.value === 'string' ? e.value.trim() : e.value
    if (value === '' && parts.length === 1) {
      // Clearing an optional field removes it; a required one fails below.
      const trial = structuredClone(block) as Record<string, unknown>
      delete trial[parts[0] as string]
      const ok = !blockSchema
        .safeParse(trial)
        .error?.issues.some((i) => String(i.path[0]) === parts[0])
      if (ok) {
        delete (block as Record<string, unknown>)[parts[0] as string]
        continue
      }
    }
    if (optionalTop) (block as Record<string, unknown>)[parts[0] as string] = value
    else setAt(block, parts, value)
    const parsed = blockSchema.safeParse(block)
    if (!parsed.success) {
      const issue = parsed.error.issues.find(
        (i) =>
          fieldRoot(i.path.join('.').replace(/\.(\d+)/g, '[$1]')) === fieldRoot(e.field) ||
          i.path.join('.').replace(/\.(\d+)/g, '[$1]') === e.field,
      )
      if (issue)
        throw new AbmError(
          422,
          `${e.blockKey}.${e.field}: ${issue.message.replace(/^Too big: expected string to have <=(\d+) characters$/, 'must be at most $1 characters').replace(/^Too small: expected string to have >=1 characters$/, 'must not be empty')}`,
        )
    }
  }

  const account = campaign.accountId ? await store.getAccount(campaign.accountId) : null
  const accountFacts = account
    ? accountFactsFrom(await store.listFacts(account.id), await store.listSources(account.id))
    : []
  const edited = claimsAfterEdit(page, claims, patch)
  const touched = new Set(patch.map((e) => `${e.blockKey}|${fieldRoot(e.field)}`))
  const next = revalidate({
    page,
    claims: edited,
    industry: campaign.industry,
    accountFacts,
    accountName: account?.name,
  }).map((c) =>
    touched.has(`${c.blockKey}|${fieldRoot(c.field)}`) && c.status !== 'rejected'
      ? { ...c, status: 'needs_review' as const }
      : c,
  )
  const v = await store.updateVersion(version.id, { page, state })
  const saved = await store.replaceClaims(version.id, next)
  await audit(actor, campaign.id, 'version.edited', {
    version: v.number,
    fields: patch.map((e) => `${e.blockKey}.${e.field}`),
    ...forkInfo,
  })
  return withClaims(v, saved)
}

export async function submitVersion(actor: Actor, versionId: string): Promise<VersionWithClaims> {
  allow(actor, ['marketer'])
  const { store } = rt()
  const { version, campaign } = await loadVersion(actor, versionId)
  if (campaign.currentVersionId !== version.id)
    throw new AbmError(409, 'Only the current version can be submitted.')
  if (version.state !== 'draft' && version.state !== 'changes_requested')
    throw new AbmError(
      409,
      `This version is ${version.state.replace('_', ' ')}; nothing to submit.`,
    )
  const v = await store.updateVersion(version.id, { state: 'in_review' })
  await store.updateCampaign(campaign.id, {
    status: isLive(campaign.status) ? campaign.status : 'in_review',
    reviewReadyAt: campaign.reviewReadyAt ?? nowIso(),
  })
  await audit(actor, campaign.id, 'version.submitted', { version: v.number })
  return withClaims(v)
}

export async function reviewClaim(
  actor: Actor,
  claimId: string,
  input: { status: Claim['status']; note?: string },
): Promise<VersionWithClaims> {
  allow(actor, ['reviewer'])
  const { store } = rt()
  const claim = await store.getClaim(claimId)
  if (!claim) throw new AbmError(404, 'Claim not found.')
  const { version, campaign } = await loadVersion(actor, claim.versionId)
  if (campaign.currentVersionId !== version.id)
    throw new AbmError(409, 'This claim belongs to an older version.')
  if (version.state === 'approved')
    throw new AbmError(409, 'This version is approved and frozen. Edit it to start a new version.')
  if (claim.status === 'rejected' && input.status !== 'rejected')
    throw new AbmError(
      409,
      'Rejected text has already been removed from the page. Edit the field to add it back.',
    )
  const patch = {
    status: input.status,
    note: input.note ?? null,
    reviewedBy: actor.role as ActorRole,
    reviewedAt: nowIso(),
  }
  if (input.status !== 'rejected') {
    await store.updateClaim(claimId, patch)
    await audit(actor, campaign.id, `claim.${input.status}`, {
      version: version.number,
      claim: claim.text,
      claimId,
      ...(input.note ? { note: input.note } : {}),
      validatorOk: claim.validator.ok,
    })
    return withClaims((await store.getVersion(version.id))!)
  }
  // Reject: remove the claim's sentence (or item, or block) from the page.
  const claims = (await store.listClaims(version.id)).map((c) =>
    c.id === claimId ? { ...c, ...patch } : c,
  )
  const removal = removeRejectedClaims(version.page, claims)
  const v = await store.updateVersion(version.id, { page: removal.page })
  const saved = await store.replaceClaims(version.id, removal.claims)
  await audit(actor, campaign.id, 'claim.rejected', {
    version: version.number,
    claim: claim.text,
    claimId,
    ...(input.note ? { note: input.note } : {}),
    removedBlocks: removal.removedBlocks,
    emptyFields: removal.emptyFields,
  })
  return withClaims(v, saved)
}

export async function approveVersion(
  actor: Actor,
  versionId: string,
  note?: string,
): Promise<VersionWithClaims> {
  allow(actor, ['reviewer'])
  const { store } = rt()
  const { version, campaign } = await loadVersion(actor, versionId)
  if (campaign.currentVersionId !== version.id)
    throw new AbmError(409, 'Only the current version can be approved.')
  if (version.state !== 'in_review')
    throw new AbmError(409, 'Submit the version for review before approving it.')
  const current = await withClaims(version)
  if (current.publishBlockers.length)
    throw new AbmError(409, 'This version cannot be approved yet.', {
      publishBlockers: current.publishBlockers,
    })
  const v = await store.updateVersion(version.id, {
    state: 'approved',
    approvedBy: actor.role as ActorRole,
    approvedAt: nowIso(),
  })
  await store.updateCampaign(campaign.id, {
    status: isLive(campaign.status) ? campaign.status : 'approved',
  })
  await audit(actor, campaign.id, 'version.approved', {
    version: v.number,
    ...(note ? { note } : {}),
  })
  return withClaims(v, current.claims)
}

export async function requestChanges(
  actor: Actor,
  versionId: string,
  note: string,
): Promise<VersionWithClaims> {
  allow(actor, ['reviewer'])
  const { store } = rt()
  const { version, campaign } = await loadVersion(actor, versionId)
  if (campaign.currentVersionId !== version.id)
    throw new AbmError(409, 'Only the current version can be sent back.')
  if (version.state !== 'in_review')
    throw new AbmError(409, 'Only a version in review can be sent back.')
  const v = await store.updateVersion(version.id, { state: 'changes_requested' })
  await store.updateCampaign(campaign.id, {
    status: isLive(campaign.status) ? campaign.status : 'draft',
  })
  await audit(actor, campaign.id, 'version.changes_requested', { version: v.number, note })
  return withClaims(v)
}

// ---------------------------------------------------------------------------
// Publish and operate
// ---------------------------------------------------------------------------

async function publishVersion(
  actor: Actor,
  campaign: Campaign,
  version: Version,
  action: 'campaign.published' | 'campaign.rolled_back',
  opts: { expiresAt?: string | null } = {},
) {
  const { store } = rt()
  const blockers = publishBlockers(version.page, await store.listClaims(version.id))
  if (version.state !== 'approved')
    throw new AbmError(409, 'Only an approved version can be published.')
  if (blockers.length)
    throw new AbmError(409, 'This version cannot be published yet.', { publishBlockers: blockers })
  const token = campaign.type === 'demo' ? (campaign.token ?? randomToken()) : null
  const now = nowIso()
  const days = campaign.type === 'solutions' ? null : DEFAULT_EXPIRY_DAYS
  const nowMs = rt().now().getTime()
  let expiresAt: string | null
  if (opts.expiresAt !== undefined) {
    // An explicit date from the publish settings (null = no expiry).
    if (opts.expiresAt !== null) {
      const t = Date.parse(opts.expiresAt)
      if (!Number.isFinite(t) || t <= nowMs)
        throw new AbmError(422, 'The expiry date must be in the future.', {
          fields: { expiresAt: 'Choose a date in the future.' },
        })
      if (t > nowMs + 730 * 86_400_000)
        throw new AbmError(422, 'The expiry date must be within two years.', {
          fields: { expiresAt: 'Choose a date within two years.' },
        })
      expiresAt = new Date(t).toISOString()
    } else expiresAt = null
  } else
    expiresAt =
      campaign.expiresAt && Date.parse(campaign.expiresAt) > nowMs
        ? campaign.expiresAt
        : days
          ? new Date(nowMs + days * 86_400_000).toISOString()
          : null
  const next = { ...campaign, token }
  const liveUrl = absolute(getAbmConfig().siteUrl, publicPath(next)!)
  const seo: SeoConfig = {
    ...version.seo,
    noindex: campaign.type === 'demo' ? true : version.seo.noindex,
    canonicalUrl: liveUrl,
    ogImageUrl: absolute(getAbmConfig().siteUrl, `/api/abm/og/${campaign.id}`),
  }
  await store.updateVersion(version.id, {
    seo,
    page: { ...version.page, seo: { ...version.page.seo, noindex: seo.noindex } },
  })
  const updated = await store.updateCampaign(campaign.id, {
    token,
    status: 'published',
    publishedVersionId: version.id,
    publishedAt: now,
    expiresAt,
    noindex: seo.noindex,
  })
  await audit(actor, campaign.id, action, {
    version: version.number,
    versionId: version.id,
    path: publicPath({ ...next, token: next.token ? '…' : null }),
    expiresAt,
  })
  return { liveUrl, campaign: updated }
}

export async function publish(
  actor: Actor,
  campaignId: string,
  versionId: string,
  opts: { expiresAt?: string | null } = {},
): Promise<{ liveUrl: string }> {
  allow(actor, ['marketer'])
  const campaign = await loadCampaign(actor, campaignId)
  if (campaign.status === 'archived') throw new AbmError(409, 'This campaign is archived.')
  const version = await rt().store.getVersion(versionId)
  if (!version || version.campaignId !== campaign.id)
    throw new AbmError(404, 'Version not found on this campaign.')
  const { liveUrl } = await publishVersion(actor, campaign, version, 'campaign.published', opts)
  return { liveUrl }
}

export async function pause(actor: Actor, campaignId: string): Promise<Campaign> {
  allow(actor, ['marketer'])
  const campaign = await loadCampaign(actor, campaignId)
  if (campaign.status !== 'published')
    throw new AbmError(409, 'Only a published page can be paused.')
  const c = await rt().store.updateCampaign(campaign.id, { status: 'paused' })
  await audit(actor, campaign.id, 'campaign.paused')
  return c
}

export async function resume(actor: Actor, campaignId: string): Promise<Campaign> {
  allow(actor, ['marketer'])
  const campaign = await loadCampaign(actor, campaignId)
  if (campaign.status !== 'paused') throw new AbmError(409, 'Only a paused page can be resumed.')
  const c = await rt().store.updateCampaign(campaign.id, { status: 'published' })
  await audit(actor, campaign.id, 'campaign.resumed')
  return c
}

/** Republish an earlier approved version as a new 'rollback' version. */
export async function rollback(
  actor: Actor,
  campaignId: string,
  versionId: string,
): Promise<{ liveUrl: string }> {
  allow(actor, ['marketer'])
  const { store } = rt()
  const campaign = await loadCampaign(actor, campaignId)
  const target = await store.getVersion(versionId)
  if (!target || target.campaignId !== campaign.id)
    throw new AbmError(404, 'Version not found on this campaign.')
  if (!target.approvedAt)
    throw new AbmError(409, 'Only a version that was approved can be rolled back to.')
  if (target.id === campaign.publishedVersionId)
    throw new AbmError(409, 'That version is already live.')
  const versions = await store.listVersions(campaign.id)
  const claims = await store.listClaims(target.id)
  const { version } = await store.createVersion(
    {
      campaignId: campaign.id,
      number: (versions.at(-1)?.number ?? 0) + 1,
      createdBy: actor.role as ActorRole,
      origin: 'rollback',
      state: 'approved',
      page: target.page,
      seo: target.seo,
      cta: target.cta,
      model: target.model,
      simulated: target.simulated,
      approvedBy: target.approvedBy,
      approvedAt: target.approvedAt,
    },
    claims.map(asNewClaim),
  )
  await store.updateCampaign(campaign.id, { currentVersionId: version.id })
  const { liveUrl } = await publishVersion(
    actor,
    { ...campaign, currentVersionId: version.id },
    version,
    'campaign.rolled_back',
  )
  return { liveUrl }
}

/** Copy a campaign for another account. Account facts and the old account's sentences are cleared. */
export async function duplicate(
  actor: Actor,
  campaignId: string,
  brief: AccountBrief,
): Promise<Campaign> {
  allow(actor, ['marketer'])
  const { store } = rt()
  const source = await loadCampaign(actor, campaignId)
  const fromId = source.publishedVersionId ?? source.currentVersionId
  const from = fromId ? await store.getVersion(fromId) : null
  const oldAccount = source.accountId ? await store.getAccount(source.accountId) : null
  const campaign = await createCampaign(actor, brief, { duplicateOf: source.id })
  if (!from) return campaign

  const claims = await store.listClaims(from.id)
  // Drop every account fact: remove its sentence like a rejection would.
  const marked = claims.map((c) =>
    c.kind === 'account_fact' ? { ...c, status: 'rejected' as const } : c,
  )
  const removal = removeRejectedClaims(from.page, marked)
  const page = renameAccount(removal.page, oldAccount?.name, brief.companyName)
  page.slug = campaign.slug
  const kept = removal.claims
    .filter((c) => c.kind !== 'account_fact' && c.status !== 'rejected')
    .map(asNewClaim)
    .map((c) => ({
      ...c,
      text: oldAccount ? replaceAll(c.text, oldAccount.name, brief.companyName) : c.text,
      status: 'needs_review' as const,
      reviewedBy: null,
      reviewedAt: null,
      note: null,
    }))
  const next: NewClaim[] = revalidate({
    page,
    claims: kept,
    industry: campaign.industry,
    accountFacts: [],
    accountName: brief.companyName,
  })
  const { version } = await store.createVersion(
    {
      campaignId: campaign.id,
      number: 1,
      createdBy: actor.role as ActorRole,
      origin: 'duplicate',
      state: 'draft',
      page,
      seo: seoFor(campaign, page),
      cta: from.cta,
      model: from.model,
      simulated: from.simulated,
      approvedBy: null,
      approvedAt: null,
    },
    next,
  )
  return store.updateCampaign(campaign.id, { currentVersionId: version.id })
}

function replaceAll(text: string, from: string, to: string) {
  return from ? text.split(from).join(to) : text
}

function renameAccount(page: Page, from: string | undefined, to: string): Page {
  const out = structuredClone(page)
  if (!from) return out
  out.title = replaceAll(out.title, from, to).slice(0, 90)
  out.seo.title = replaceAll(out.seo.title, from, to).slice(0, 60)
  out.seo.description = replaceAll(out.seo.description, from, to).slice(0, 160)
  for (const block of out.blocks) {
    for (const e of copyEntries(block)) {
      if (e.text.includes(from)) setAt(block, e.field, replaceAll(e.text, from, to))
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Analytics for the dashboards
// ---------------------------------------------------------------------------

export async function engagement(actor: Actor, id: string) {
  const campaign = await loadCampaign(actor, id)
  return analyticsFor([campaign]).engagement(campaign.id)
}

export async function overview(actor: Actor) {
  const campaigns = await rt().store.listCampaigns(actor.workspace, {
    since: actor.workspace === 'demo' ? new Date(rt().now().getTime() - 7 * 86_400_000) : undefined,
  })
  return analyticsFor(campaigns).overview(actor.workspace)
}
