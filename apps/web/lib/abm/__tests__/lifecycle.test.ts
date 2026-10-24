import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { UNSUPPORTED_CLAIM_PHRASE } from '@pageforge/agents'
import { POST as session } from '@/app/api/abm/session/route'
import { GET as listCampaigns, POST as createCampaign } from '@/app/api/abm/campaigns/route'
import { GET as getCampaign } from '@/app/api/abm/campaigns/[id]/route'
import { POST as sources } from '@/app/api/abm/campaigns/[id]/sources/route'
import { PATCH as facts } from '@/app/api/abm/campaigns/[id]/facts/route'
import { POST as draft } from '@/app/api/abm/campaigns/[id]/draft/route'
import { POST as publish } from '@/app/api/abm/campaigns/[id]/publish/route'
import { POST as pause } from '@/app/api/abm/campaigns/[id]/pause/route'
import { POST as resume } from '@/app/api/abm/campaigns/[id]/resume/route'
import { POST as rollback } from '@/app/api/abm/campaigns/[id]/rollback/route'
import { POST as duplicate } from '@/app/api/abm/campaigns/[id]/duplicate/route'
import { GET as audit } from '@/app/api/abm/campaigns/[id]/audit/route'
import { GET as engagement } from '@/app/api/abm/campaigns/[id]/engagement/route'
import { PATCH as editVersion } from '@/app/api/abm/versions/[id]/route'
import { POST as submit } from '@/app/api/abm/versions/[id]/submit/route'
import { POST as approve } from '@/app/api/abm/versions/[id]/approve/route'
import { POST as requestChanges } from '@/app/api/abm/versions/[id]/request-changes/route'
import { PATCH as reviewClaim } from '@/app/api/abm/claims/[id]/route'
import { POST as events } from '@/app/api/abm/events/route'
import { GET as leads, POST as postLead } from '@/app/api/abm/leads/route'
import { GET as slots } from '@/app/api/abm/slots/route'
import { POST as meetings } from '@/app/api/abm/meetings/route'
import { GET as overview } from '@/app/api/abm/overview/route'
import { getAccountPage } from '../public'
import { setAbmRuntime } from '../runtime'
import type { CampaignDetail, VersionWithClaims } from '../types'
import { clearEnv, cookieFrom, params, req, testRuntime } from './helpers'

const brief = {
  companyName: 'Northstar Port Authority',
  companyUrl: 'https://example.test/fictional/northstar-port-authority',
  industry: 'ports',
  siteCount: 4,
  campaignType: 'demo',
  goal: 'book-meeting',
  painPoints: ['night-time perimeter patrols', 'crane inspections', 'berth security after hours'],
  targetRole: 'Head of Security',
  sourceChannel: 'email',
}

async function login(role: string, workspace = 'demo', password?: string) {
  const res = await session(req('/api/abm/session', { body: { role, workspace, password } }))
  expect(res.status).toBe(200)
  return cookieFrom(res)
}

async function detail(id: string, cookie: string) {
  const res = await getCampaign(req(`/api/abm/campaigns/${id}`, { cookie }), params({ id }))
  expect(res.status).toBe(200)
  return (await res.json()) as CampaignDetail
}

describe('ABM lifecycle through the route handlers', () => {
  beforeEach(() => clearEnv())
  afterEach(() => setAbmRuntime(null))

  it('brief → sources → simulated draft → reject 40% → approve → publish → operate', async () => {
    const { drain, advance } = testRuntime()
    const marketer = await login('marketer')
    const reviewer = await login('reviewer')
    const sales = await login('sales')

    // Brief
    const bad = await createCampaign(
      req('/api/abm/campaigns', { cookie: marketer, body: { ...brief, companyUrl: 'nope' } }),
    )
    expect(bad.status).toBe(422)
    expect(((await bad.json()) as { fields: Record<string, string> }).fields.companyUrl).toMatch(
      /http/,
    )
    const forbidden = await createCampaign(
      req('/api/abm/campaigns', { cookie: sales, body: brief }),
    )
    expect(forbidden.status).toBe(403)
    const created = await createCampaign(
      req('/api/abm/campaigns', { cookie: marketer, body: brief }),
    )
    expect(created.status).toBe(201)
    expect(created.headers.get('cache-control')).toBe('no-store')
    const { campaignId: id } = (await created.json()) as { campaignId: string }

    // Sources (mocked network): home + about/facilities/news, verbatim quotes.
    const src = await sources(
      req(`/api/abm/campaigns/${id}/sources`, { cookie: marketer, body: {} }),
      params({ id }),
    )
    expect(src.status).toBe(200)
    const s = (await src.json()) as CampaignDetail
    expect(s.sources.map((x) => x.status)).toEqual(['ok', 'ok', 'ok', 'ok'])
    expect(s.sources.map((x) => new URL(x.url).pathname)).toEqual([
      '/fictional/northstar-port-authority',
      '/fictional/northstar-port-authority/about',
      '/fictional/northstar-port-authority/facilities',
      '/fictional/northstar-port-authority/news',
    ])
    expect(s.facts.length).toBeGreaterThan(5)
    expect(s.facts.map((f) => f.quote)).toContain(
      'Northstar Port Authority operates four container terminals and two cruise berths on the Halden estuary.',
    )
    // Exclude one fact.
    const excluded = s.facts.at(-1)!
    const f = await facts(
      req(`/api/abm/campaigns/${id}/facts`, {
        method: 'PATCH',
        cookie: marketer,
        body: [{ factId: excluded.id, included: false }],
      }),
      params({ id }),
    )
    expect(
      ((await f.json()) as CampaignDetail).facts.find((x) => x.id === excluded.id)?.included,
    ).toBe(false)

    // Draft (202 now, work after the response).
    const d = await draft(
      req(`/api/abm/campaigns/${id}/draft`, { cookie: marketer, body: {} }),
      params({ id }),
    )
    expect(d.status).toBe(202)
    const { versionId } = (await d.json()) as { versionId: string }
    expect((await detail(id, marketer)).status).toBe('generating')
    await drain()
    advance(1000)
    let c = await detail(id, marketer)
    expect(c.status).toBe('in_review')
    expect(c.reviewReadyAt).not.toBeNull()
    const v1 = c.current!
    expect(v1.id).toBe(versionId)
    expect(v1.simulated).toBe(true)
    expect(v1.page.blocks[0]?._type).toBe('hero')
    const bad40 = v1.claims.filter((x) => x.text.includes(UNSUPPORTED_CLAIM_PHRASE))
    expect(bad40).toHaveLength(1)
    expect(bad40[0]!.status).toBe('needs_review')
    expect(v1.claims.filter((x) => x.status === 'needs_review')).toHaveLength(1)
    expect(
      v1.claims.some((x) => x.kind === 'account_fact' && x.sources[0]?.type === 'account_source'),
    ).toBe(true)
    expect(
      v1.claims.every(
        (x) =>
          !x.sources.some((y) => y.type === 'account_source' && y.sourceFactId === excluded.id),
      ),
    ).toBe(true)
    expect(v1.publishBlockers).toEqual(['1 claim needs review.'])

    // Approve is blocked while the claim needs review; marketers cannot review.
    const early = await approve(
      req(`/api/abm/versions/${versionId}/approve`, { cookie: reviewer, body: {} }),
      params({ id: versionId }),
    )
    expect(early.status).toBe(409)
    expect(((await early.json()) as { publishBlockers: string[] }).publishBlockers).toEqual([
      '1 claim needs review.',
    ])
    const asMarketer = await reviewClaim(
      req(`/api/abm/claims/${bad40[0]!.id}`, {
        method: 'PATCH',
        cookie: marketer,
        body: { status: 'rejected' },
      }),
      params({ id: bad40[0]!.id }),
    )
    expect(asMarketer.status).toBe(403)

    // Reviewer rejects the 40% claim: its sentence is removed from the page.
    const rj = await reviewClaim(
      req(`/api/abm/claims/${bad40[0]!.id}`, {
        method: 'PATCH',
        cookie: reviewer,
        body: { status: 'rejected', note: 'No source for 40%.' },
      }),
      params({ id: bad40[0]!.id }),
    )
    expect(rj.status).toBe(200)
    const afterReject = (await rj.json()) as VersionWithClaims
    expect(JSON.stringify(afterReject.page)).not.toContain('40%')
    expect(afterReject.publishBlockers).toEqual([])
    const undo = await reviewClaim(
      req(`/api/abm/claims/${bad40[0]!.id}`, {
        method: 'PATCH',
        cookie: reviewer,
        body: { status: 'supported' },
      }),
      params({ id: bad40[0]!.id }),
    )
    expect(undo.status).toBe(409)

    // Approve, then publish (marketer).
    const ap = await approve(
      req(`/api/abm/versions/${versionId}/approve`, { cookie: reviewer, body: { note: 'OK' } }),
      params({ id: versionId }),
    )
    expect(ap.status).toBe(200)
    expect(((await ap.json()) as VersionWithClaims).state).toBe('approved')
    const pubByReviewer = await publish(
      req(`/api/abm/campaigns/${id}/publish`, { cookie: reviewer, body: { versionId } }),
      params({ id }),
    )
    expect(pubByReviewer.status).toBe(403)
    const pub = await publish(
      req(`/api/abm/campaigns/${id}/publish`, { cookie: marketer, body: { versionId } }),
      params({ id }),
    )
    expect(pub.status).toBe(200)
    const { liveUrl } = (await pub.json()) as { liveUrl: string }
    const m = /\/demo\/((northstar-port-authority(?:-\d+)?)-([a-z2-9]{12}))$/.exec(liveUrl)
    expect(m).not.toBeNull()
    c = await detail(id, marketer)
    expect(c.status).toBe('published')
    expect(c.liveUrl).toBe(liveUrl)
    expect(c.current?.seo.canonicalUrl).toBe(liveUrl)
    expect(c.current?.seo.noindex).toBe(true)
    expect(c.current?.seo.ogImageUrl).toMatch(new RegExp(`/api/abm/og/${id}$`))
    expect(c.trackingLinks.map((l) => l.channel)).toEqual(['email', 'linkedin', 'sales-sequence'])
    expect(new URL(c.trackingLinks[1]!.url).searchParams.get('utm_medium')).toBe('social')
    expect(new URL(c.trackingLinks[0]!.url).searchParams.get('utm_campaign')).toBe(`abm-${m![2]}`)

    // Public read: right token → page; wrong token → null (404).
    const page = await getAccountPage({ type: 'demo', slugToken: m![1]! })
    expect(page && 'page' in page && page.accountName).toBe('Northstar Port Authority')
    expect(page && 'page' in page && JSON.stringify(page.page)).not.toContain('40%')
    const token = m![3]!
    const wrong = `${m![2]}-${token.slice(0, 11)}${token[11] === 'a' ? 'b' : 'a'}`
    expect(await getAccountPage({ type: 'demo', slugToken: wrong })).toBeNull()
    expect(await getAccountPage({ type: 'demo', slugToken: m![2]! })).toBeNull()
    expect(await getAccountPage({ type: 'campaign', slug: m![2]! })).toBeNull()

    // Prospect: events, lead, meeting.
    const visitorId = 'visitor_abc12345'
    const ev = (type: string, props?: Record<string, number | string>) =>
      events(
        req('/api/abm/events', {
          body: {
            campaignId: id,
            versionId,
            pageKind: 'account',
            path: new URL(liveUrl).pathname,
            visitorId,
            type,
            props,
            utm: { source: 'email' },
          },
        }),
      )
    expect((await ev('page_view')).status).toBe(204)
    expect((await ev('scroll_depth', { depth: 75 })).status).toBe(204)
    expect((await ev('cta_click')).headers.get('x-abm-event')).toBe('stored')
    const lead = await postLead(
      req('/api/abm/leads', {
        body: {
          campaignId: id,
          versionId,
          visitorId,
          fields: {
            name: 'Asha Rao',
            email: 'Asha@Northstar.example',
            company: 'Northstar Port Authority',
            role: 'Head of Security',
          },
          utm: { source: 'email' },
        },
      }),
    )
    expect(lead.status).toBe(201)
    const { leadId } = (await lead.json()) as { leadId: string }
    expect((await ev('form_submit', { form: 'lead' })).headers.get('x-abm-event')).toBe('stored')
    // Typed props are validated.
    expect((await ev('form_submit', { form: 'other' })).status).toBe(422)
    const sl = (await (await slots(req(`/api/abm/slots?campaignId=${id}`))).json()) as {
      slots: string[]
    }
    expect(sl.slots.length).toBeGreaterThan(50)
    const book = (slot: string) =>
      meetings(
        req('/api/abm/meetings', {
          body: {
            campaignId: id,
            leadId,
            visitorId,
            slotStart: slot,
            timezone: 'Asia/Kolkata',
            name: 'Asha Rao',
            email: 'asha@northstar.example',
            company: 'Northstar Port Authority',
          },
        }),
      )
    const mt = await book(sl.slots[0]!)
    expect(mt.status).toBe(201)
    await ev('meeting_booked', { slot: sl.slots[0]!, timezone: 'Asia/Kolkata' })
    expect((await book(sl.slots[0]!)).status).toBe(409)
    const sl2 = (await (await slots(req(`/api/abm/slots?campaignId=${id}`))).json()) as {
      slots: string[]
    }
    expect(sl2.slots).not.toContain(sl.slots[0])

    const eng = (await (
      await engagement(
        req(`/api/abm/campaigns/${id}/engagement`, { cookie: sales }),
        params({ id }),
      )
    ).json()) as Record<string, unknown>
    expect(eng).toMatchObject({
      visitors: 1,
      views: 1,
      maxScroll: 75,
      ctaClicks: 1,
      formSubmits: 1,
      meetings: 1,
      hot: true,
    })
    const crm = (await (await leads(req('/api/abm/leads', { cookie: sales }))).json()) as {
      leads: Record<string, unknown>[]
    }
    const mine = crm.leads.find((l) => l.id === leadId)!
    expect(mine).toMatchObject({
      email: 'asha@northstar.example',
      crmProvider: 'builtin',
      crmStatus: 'synced',
      meetingAt: sl.slots[0],
    })

    // Pause → 'paused'; events are dropped; resume.
    expect(
      (
        await pause(
          req(`/api/abm/campaigns/${id}/pause`, { cookie: marketer, body: {} }),
          params({ id }),
        )
      ).status,
    ).toBe(200)
    expect(await getAccountPage({ type: 'demo', slugToken: m![1]! })).toEqual({ status: 'paused' })
    expect((await ev('page_view')).headers.get('x-abm-event')).toBe('dropped')
    expect(
      (
        await resume(
          req(`/api/abm/campaigns/${id}/resume`, { cookie: marketer, body: {} }),
          params({ id }),
        )
      ).status,
    ).toBe(200)

    // Edit the approved version → new 'edit' version; edited claims need review again.
    const hero = afterReject.page.blocks[0]!
    const heroClaim = afterReject.claims.find(
      (x) => x.blockKey === hero._key && x.field === 'subheading',
    )!
    const edit = await editVersion(
      req(`/api/abm/versions/${versionId}`, {
        method: 'PATCH',
        cookie: marketer,
        body: [
          {
            blockKey: hero._key,
            field: 'subheading',
            value: `${heroClaim.text} Patrols run 6 times a night.`,
          },
        ],
      }),
      params({ id: versionId }),
    )
    expect(edit.status).toBe(200)
    const v2 = (await edit.json()) as VersionWithClaims
    expect(v2.id).not.toBe(versionId)
    expect(v2.origin).toBe('edit')
    expect(v2.state).toBe('draft')
    const edited = v2.claims.filter((x) => x.blockKey === hero._key && x.field === 'subheading')
    expect(edited.every((x) => x.status === 'needs_review')).toBe(true)
    expect(edited.some((x) => x.origin === 'edit' && x.text.includes('6 times'))).toBe(true)
    // The live page still serves v1.
    c = await detail(id, marketer)
    expect(c.publishedVersionId).toBe(versionId)
    expect(c.status).toBe('published')

    // Too long → 422; editing an old version → 409.
    const long = await editVersion(
      req(`/api/abm/versions/${v2.id}`, {
        method: 'PATCH',
        cookie: marketer,
        body: [{ blockKey: hero._key, field: 'heading', value: 'x'.repeat(200) }],
      }),
      params({ id: v2.id }),
    )
    expect(long.status).toBe(422)
    const old = await editVersion(
      req(`/api/abm/versions/${versionId}`, {
        method: 'PATCH',
        cookie: marketer,
        body: { cta: { label: 'Talk to us', kind: 'form', formFields: [] } },
      }),
      params({ id: versionId }),
    )
    expect(old.status).toBe(409)

    // Submit v2 → request changes → resubmit → review → approve → publish v2.
    expect(
      (
        await submit(
          req(`/api/abm/versions/${v2.id}/submit`, { cookie: marketer, body: {} }),
          params({ id: v2.id }),
        )
      ).status,
    ).toBe(200)
    const rc = await requestChanges(
      req(`/api/abm/versions/${v2.id}/request-changes`, {
        cookie: reviewer,
        body: { note: 'Check the patrol count.' },
      }),
      params({ id: v2.id }),
    )
    expect(((await rc.json()) as VersionWithClaims).state).toBe('changes_requested')
    expect(
      (
        await submit(
          req(`/api/abm/versions/${v2.id}/submit`, { cookie: marketer, body: {} }),
          params({ id: v2.id }),
        )
      ).status,
    ).toBe(200)
    for (const claim of edited) {
      const r = await reviewClaim(
        req(`/api/abm/claims/${claim.id}`, {
          method: 'PATCH',
          cookie: reviewer,
          body: { status: 'supported' },
        }),
        params({ id: claim.id }),
      )
      expect(r.status).toBe(200)
    }
    let v2now = (await detail(id, marketer)).current!
    for (const claim of v2now.claims.filter((x) => x.status === 'needs_review')) {
      await reviewClaim(
        req(`/api/abm/claims/${claim.id}`, {
          method: 'PATCH',
          cookie: reviewer,
          body: { status: 'supported' },
        }),
        params({ id: claim.id }),
      )
    }
    v2now = (await detail(id, marketer)).current!
    expect(v2now.publishBlockers).toEqual([])
    expect(
      (
        await approve(
          req(`/api/abm/versions/${v2.id}/approve`, { cookie: reviewer, body: {} }),
          params({ id: v2.id }),
        )
      ).status,
    ).toBe(200)
    const pub2 = await publish(
      req(`/api/abm/campaigns/${id}/publish`, { cookie: marketer, body: { versionId: v2.id } }),
      params({ id }),
    )
    expect(((await pub2.json()) as { liveUrl: string }).liveUrl).toBe(liveUrl) // same token
    const live2 = await getAccountPage({ type: 'demo', slugToken: m![1]! })
    expect(live2 && 'versionId' in live2 && live2.versionId).toBe(v2.id)

    // Rollback to v1 → new 'rollback' version is live.
    const rb = await rollback(
      req(`/api/abm/campaigns/${id}/rollback`, { cookie: marketer, body: { versionId } }),
      params({ id }),
    )
    expect(rb.status).toBe(200)
    c = await detail(id, marketer)
    expect(c.versions.map((v) => v.origin)).toEqual(['ai_draft', 'edit', 'rollback'])
    expect(c.publishedVersionId).toBe(c.versions[2]!.id)
    const live3 = await getAccountPage({ type: 'demo', slugToken: m![1]! })
    expect(live3 && 'page' in live3 && JSON.stringify(live3.page)).not.toContain('6 times')

    // Duplicate for another account: account facts cleared, new campaign in draft.
    const dup = await duplicate(
      req(`/api/abm/campaigns/${id}/duplicate`, {
        cookie: marketer,
        body: {
          brief: { ...brief, companyName: 'Baywater Ports', companyUrl: 'https://example.test/' },
        },
      }),
      params({ id }),
    )
    expect(dup.status).toBe(201)
    const { campaignId: dupId } = (await dup.json()) as { campaignId: string }
    const dc = await detail(dupId, marketer)
    expect(dc.status).toBe('draft')
    expect(dc.slug).toBe('baywater-ports')
    expect(dc.facts).toEqual([])
    expect(dc.current?.origin).toBe('duplicate')
    expect(dc.current?.claims.some((x) => x.kind === 'account_fact')).toBe(false)
    const dupCopy = JSON.stringify(dc.current?.page)
    expect(dupCopy).not.toContain('Northstar')
    expect(dupCopy).toContain('Baywater Ports')
    expect(dupCopy).not.toContain('Halden')

    // Audit has every action with the actor role.
    const log = (await (
      await audit(req(`/api/abm/campaigns/${id}/audit`, { cookie: sales }), params({ id }))
    ).json()) as { entries: { action: string; actorRole: string }[] }
    const actions = log.entries.map((e) => `${e.actorRole}:${e.action}`)
    const rejected = log.entries.find((e) => e.action === 'claim.rejected') as unknown as {
      detail: Record<string, unknown>
    }
    expect(rejected.detail).toMatchObject({ version: 1, note: 'No source for 40%.' })
    expect(String(rejected.detail.claim)).toContain('40%')
    for (const a of [
      'marketer:brief.created',
      'marketer:sources.fetched',
      'marketer:facts.updated',
      'marketer:draft.requested',
      'marketer:draft.generated',
      'reviewer:claim.rejected',
      'reviewer:claim.supported',
      'reviewer:version.approved',
      'marketer:campaign.published',
      'marketer:campaign.paused',
      'marketer:campaign.resumed',
      'marketer:version.edited',
      'marketer:version.submitted',
      'reviewer:version.changes_requested',
      'marketer:campaign.rolled_back',
      'system:lead.created',
      'system:meeting.booked',
    ])
      expect(actions, a).toContain(a)

    // Expiry is checked on read (default 60 days for demo pages).
    advance(61 * 86_400_000)
    expect(await getAccountPage({ type: 'demo', slugToken: m![1]! })).toEqual({ status: 'expired' })
    // Sessions last 12 hours, and demo rows older than 7 days are purged on the next visit.
    expect(
      (await getCampaign(req(`/api/abm/campaigns/${id}`, { cookie: marketer }), params({ id })))
        .status,
    ).toBe(401)
    const marketer2 = await login('marketer')
    expect(
      (await getCampaign(req(`/api/abm/campaigns/${id}`, { cookie: marketer2 }), params({ id })))
        .status,
    ).toBe(404)
  })

  it('isolates workspaces and guards the main workspace with the password', async () => {
    testRuntime()
    const noPw = await session(
      req('/api/abm/session', { body: { role: 'marketer', workspace: 'main' } }),
    )
    expect(noPw.status).toBe(403)
    process.env.FACTORY_ADMIN_PASSWORD = 'correct horse'
    expect(
      (
        await session(
          req('/api/abm/session', {
            body: { role: 'marketer', workspace: 'main', password: 'wrong' },
          }),
        )
      ).status,
    ).toBe(401)
    const main = await login('marketer', 'main', 'correct horse')
    const demo = await login('marketer')
    const created = await createCampaign(req('/api/abm/campaigns', { cookie: main, body: brief }))
    const { campaignId } = (await created.json()) as { campaignId: string }
    const fromDemo = await getCampaign(
      req(`/api/abm/campaigns/${campaignId}`, { cookie: demo }),
      params({ id: campaignId }),
    )
    expect(fromDemo.status).toBe(404)
    const list = (await (
      await listCampaigns(req('/api/abm/campaigns', { cookie: main }))
    ).json()) as { campaigns: { id: string }[] }
    expect(list.campaigns.map((c) => c.id)).toEqual([campaignId])
    const unauth = await getCampaign(
      req(`/api/abm/campaigns/${campaignId}`),
      params({ id: campaignId }),
    )
    expect(unauth.status).toBe(401)
    const tampered = await getCampaign(
      req(`/api/abm/campaigns/${campaignId}`, { cookie: `${main}x` }),
      params({ id: campaignId }),
    )
    expect(tampered.status).toBe(401)
  })

  it('records a failed draft without losing the campaign', async () => {
    const { drain } = testRuntime({
      llm: () => ({
        llm: {
          generateJson: async () => {
            throw new Error('model down key=AIzaSyA1234567890abcdefghijklmn')
          },
        },
        simulated: false,
        models: ['gemini-3.8-flash'],
      }),
    })
    const marketer = await login('marketer')
    const { campaignId: id } = (await (
      await createCampaign(req('/api/abm/campaigns', { cookie: marketer, body: brief }))
    ).json()) as { campaignId: string }
    await draft(
      req(`/api/abm/campaigns/${id}/draft`, { cookie: marketer, body: {} }),
      params({ id }),
    )
    await drain()
    const c = await detail(id, marketer)
    expect(c.status).toBe('draft')
    expect(c.current).toBeNull()
    expect(c.versions).toEqual([])
    expect(c.lastError).toContain('model down')
    expect(c.lastError).not.toContain('AIza')
  })

  it('rate-limits drafts per network in the demo workspace', async () => {
    const { drain } = testRuntime()
    const marketer = await login('marketer')
    const { campaignId: id } = (await (
      await createCampaign(req('/api/abm/campaigns', { cookie: marketer, body: brief }))
    ).json()) as { campaignId: string }
    const codes: number[] = []
    for (let i = 0; i < 6; i++) {
      codes.push(
        (
          await draft(
            req(`/api/abm/campaigns/${id}/draft`, {
              cookie: marketer,
              body: {},
              ip: '198.51.100.7',
            }),
            params({ id }),
          )
        ).status,
      )
      await drain()
    }
    expect(codes).toEqual([202, 202, 202, 202, 202, 429])
  })

  it('overview compares account and generic pages without declaring a winner on small samples', async () => {
    testRuntime()
    const sales = await login('sales')
    const res = await overview(req('/api/abm/overview', { cookie: sales }))
    const body = (await res.json()) as {
      comparison: Record<string, unknown>
      review: Record<string, number>
    }
    expect(body.comparison.insufficientSample).toBe(true)
    expect(body.comparison.illustrative).toBe(true)
    expect(body.review.avgClaims).toBeGreaterThan(10)
  })
})
