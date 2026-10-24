import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as events } from '@/app/api/abm/events/route'
import { POST as postLead } from '@/app/api/abm/leads/route'
import { POST as meetings } from '@/app/api/abm/meetings/route'
import { availableSlots, zonedToUtc } from '../calendar'
import {
  createHubSpotClient,
  leadNote,
  syncLeadToHubSpot,
  HUBSPOT_API,
  type FetchLike,
} from '../crm'
import {
  getAccountPage,
  getSolutionsPage,
  listPublicSolutionsPaths,
  parseSlugToken,
} from '../public'
import { getAbmRuntime, setAbmRuntime } from '../runtime'
import { ensureDemoSeed } from '../seed'
import { signSession, verifySession } from '../session'
import type { Lead } from '../types'
import { clearEnv, req, testRuntime } from './helpers'

/** A HubSpot-shaped fake token, built at runtime so secret scanners do not flag the test. */
const fakeHubSpotToken = (c: string) => ['pat', 'na1', c.repeat(8), c.repeat(4), c.repeat(4), c.repeat(4), c.repeat(12)].join('-')

beforeEach(() => clearEnv())
afterEach(() => setAbmRuntime(null))

async function seededDemo() {
  const t = testRuntime()
  const result = await ensureDemoSeed()
  const campaigns = await getAbmRuntime().store.listCampaigns('demo')
  return { ...t, result, campaigns }
}

describe('demo seed', () => {
  it('creates Northstar (published), Halvorsen (in review) and /solutions/ports once', async () => {
    const { result, campaigns, runtime } = await seededDemo()
    expect(result.seeded).toBe(true)
    const byType = Object.fromEntries(campaigns.map((c) => [c.type, c]))
    expect(byType.demo?.status).toBe('published')
    expect(byType.campaign?.status).toBe('in_review')
    expect(byType.solutions?.status).toBe('published')
    const halvorsen = await runtime.store.listClaims(byType.campaign!.currentVersionId!)
    expect(halvorsen.filter((c) => c.status === 'needs_review')).toHaveLength(1)
    expect(halvorsen.find((c) => c.status === 'needs_review')?.text).toContain('40%')

    const ids = campaigns.map((c) => c.id)
    const ev = await runtime.store.listEvents({ campaignIds: ids })
    expect(ev.length).toBeGreaterThan(150)
    expect(ev.length).toBeLessThan(260)
    expect(ev.every((e) => e.props.illustrative === true)).toBe(true)
    const leads = await runtime.store.listLeads(ids)
    expect(leads).toHaveLength(6)
    expect(leads.every((l) => l.illustrative)).toBe(true)
    expect(await runtime.store.listMeetings(ids)).toHaveLength(3)
    const spread = ev.map((e) => Date.parse(e.createdAt))
    expect(Math.max(...spread) - Math.min(...spread)).toBeGreaterThan(14 * 86_400_000)

    // Idempotent: a second call does nothing.
    const again = await ensureDemoSeed()
    expect(again.seeded).toBe(false)
    expect(await runtime.store.listCampaigns('demo')).toHaveLength(3)
    // Concurrent first calls seed once.
    testRuntime()
    await Promise.all([ensureDemoSeed(), ensureDemoSeed(), ensureDemoSeed()])
    expect(await getAbmRuntime().store.listCampaigns('demo')).toHaveLength(3)
  })

  it('serves the seeded pages through the public read API', async () => {
    const { campaigns } = await seededDemo()
    const demo = campaigns.find((c) => c.type === 'demo')!
    const page = await getAccountPage({ type: 'demo', slugToken: `${demo.slug}-${demo.token}` })
    expect(page && 'page' in page && page.accountName).toBe('Northstar Port Authority')
    expect(page && 'page' in page && page.canonicalUrl).toMatch(
      /\/demo\/northstar-port-authority-[a-z2-9]{12}$/,
    )
    expect(await getSolutionsPage('ports')).toMatchObject({
      type: 'solutions',
      industry: 'ports',
      accountName: null,
    })
    expect(await getSolutionsPage('solar')).toBeNull()
    expect(await getSolutionsPage('../etc')).toBeNull()
    expect(await listPublicSolutionsPaths()).toEqual(['/solutions/ports'])
    // The in-review Halvorsen campaign page is not public.
    const hv = campaigns.find((c) => c.type === 'campaign')!
    expect(await getAccountPage({ type: 'campaign', slug: hv.slug })).toBeNull()
  })

  it('parses slug-token paths strictly', () => {
    expect(parseSlugToken('northstar-port-authority-abcdefghjk23')).toEqual({
      slug: 'northstar-port-authority',
      token: 'abcdefghjk23',
    })
    expect(parseSlugToken('northstar-ABCDEFGHJK23')).toBeNull()
    expect(parseSlugToken('short-abc')).toBeNull()
  })
})

describe('events', () => {
  it('rate-limits each visitor to 120 events a minute and drops unknown campaigns', async () => {
    const { campaigns, advance, runtime } = await seededDemo()
    const demo = campaigns.find((c) => c.type === 'demo')!
    const body = {
      campaignId: demo.id,
      versionId: demo.publishedVersionId,
      pageKind: 'account',
      path: '/demo/x',
      visitorId: 'visitor_rate_1',
      type: 'scroll_depth',
      props: { depth: 25 },
    }
    const outcomes: string[] = []
    for (let i = 0; i < 122; i++)
      outcomes.push((await events(req('/api/abm/events', { body }))).headers.get('x-abm-event')!)
    expect(outcomes.filter((o) => o === 'stored')).toHaveLength(120)
    expect(outcomes.slice(-2)).toEqual(['rate_limited', 'rate_limited'])
    advance(60_000)
    expect((await events(req('/api/abm/events', { body }))).headers.get('x-abm-event')).toBe(
      'stored',
    )

    // Wrong page kind, unknown campaign and illustrative flags from the client are dropped/stripped.
    expect(
      (
        await events(req('/api/abm/events', { body: { ...body, pageKind: 'generic' } }))
      ).headers.get('x-abm-event'),
    ).toBe('dropped')
    expect(
      (
        await events(
          req('/api/abm/events', {
            body: { ...body, campaignId: '00000000-0000-0000-0000-000000000000' },
          }),
        )
      ).headers.get('x-abm-event'),
    ).toBe('dropped')
    await events(
      req('/api/abm/events', {
        body: { ...body, visitorId: 'visitor_flag_1', props: { illustrative: true } },
      }),
    )
    const stored = (await runtime.store.listEvents({ campaignIds: [demo.id] })).filter(
      (e) => e.visitorId === 'visitor_flag_1',
    )
    expect(stored[0]?.props.illustrative).toBeUndefined()
    const invalid = await events(
      req('/api/abm/events', { body: { ...body, visitorId: 'bad id!' } }),
    )
    expect(invalid.status).toBe(422)
  })
})

describe('leads and meetings', () => {
  it('limits leads to 5 per IP per day and checks Turnstile when configured', async () => {
    const { campaigns, fetchCalls } = await seededDemo()
    const demo = campaigns.find((c) => c.type === 'demo')!
    const body = {
      campaignId: demo.id,
      versionId: demo.publishedVersionId,
      visitorId: 'visitor_lead_1',
      fields: { name: 'A B', email: 'a@b.example', company: 'C' },
    }
    const codes: number[] = []
    for (let i = 0; i < 6; i++)
      codes.push((await postLead(req('/api/abm/leads', { body, ip: '192.0.2.44' }))).status)
    expect(codes).toEqual([201, 201, 201, 201, 201, 429])

    process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAAtestsecretkeyvalue000000000'
    const noToken = await postLead(req('/api/abm/leads', { body, ip: '192.0.2.45' }))
    expect(noToken.status).toBe(403)
    const withToken = await postLead(
      req('/api/abm/leads', { body: { ...body, turnstileToken: 'tok' }, ip: '192.0.2.45' }),
    )
    // The test fetch answers {} → success is not true → refused.
    expect(withToken.status).toBe(403)
    expect(fetchCalls.at(-1)?.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
  })

  it('refuses slots that are not offered and never double-books', async () => {
    const { campaigns } = await seededDemo()
    const demo = campaigns.find((c) => c.type === 'demo')!
    const base = {
      campaignId: demo.id,
      visitorId: 'visitor_meet_1',
      timezone: 'America/New_York',
      name: 'Jo Lee',
      email: 'jo@x.example',
      company: 'X',
    }
    const odd = await meetings(
      req('/api/abm/meetings', {
        body: { ...base, slotStart: '2026-10-26T03:07:00.000Z' },
        ip: '192.0.2.50',
      }),
    )
    expect(odd.status).toBe(409)
    const slot = availableSlots(getAbmRuntime().now())[3]!
    const ok = await meetings(
      req('/api/abm/meetings', { body: { ...base, slotStart: slot }, ip: '192.0.2.50' }),
    )
    expect(ok.status).toBe(201)
    const again = await meetings(
      req('/api/abm/meetings', {
        body: { ...base, email: 'other@x.example', slotStart: slot },
        ip: '192.0.2.51',
      }),
    )
    expect(again.status).toBe(409)
    const badTz = await meetings(
      req('/api/abm/meetings', {
        body: { ...base, timezone: 'Mars/Olympus', slotStart: slot },
        ip: '192.0.2.52',
      }),
    )
    expect(badTz.status).toBe(422)
  })

  it('expires published pages on read and audits it as system', async () => {
    const { campaigns, advance, runtime } = await seededDemo()
    const demo = campaigns.find((c) => c.type === 'demo')!
    advance(Date.parse(demo.expiresAt!) - runtime.now().getTime() + 1000)
    expect(await getAccountPage({ type: 'demo', slugToken: `${demo.slug}-${demo.token}` })).toEqual(
      { status: 'expired' },
    )
    const log = await runtime.store.listAudit(demo.id)
    expect(log[0]).toMatchObject({ action: 'campaign.expired', actorRole: 'system' })
  })
})

describe('calendar', () => {
  it('offers 30-minute slots 10:00–17:00 in Kolkata and New York on the next 10 working days', () => {
    const now = new Date('2026-10-26T00:00:00Z') // Monday
    const slots = availableSlots(now)
    // 14 slots a day × 10 days × 2 zones; the zones do not overlap.
    expect(slots).toHaveLength(280)
    expect(slots[0]).toBe('2026-10-26T04:30:00.000Z') // 10:00 IST
    expect(slots).toContain('2026-10-26T14:00:00.000Z') // 10:00 EDT
    expect(slots).toContain('2026-11-02T15:00:00.000Z') // 10:00 EST after the DST change
    expect(slots).not.toContain('2026-10-31T04:30:00.000Z') // Saturday
    expect(zonedToUtc(2026, 11, 2, 16, 30, 'America/New_York')).toBe(
      Date.parse('2026-11-02T21:30:00Z'),
    )
    expect(availableSlots(now, ['2026-10-26T04:30:00.000Z'])[0]).toBe('2026-10-26T05:00:00.000Z')
  })
})

describe('session cookie', () => {
  it('signs and verifies, rejecting tampering and expiry', () => {
    const v = signSession({ workspace: 'demo', role: 'reviewer' }, 2_000, 'secret')
    expect(verifySession(v, 'secret', 1_000)).toEqual({ workspace: 'demo', role: 'reviewer' })
    expect(verifySession(v, 'secret', 3_000)).toBeNull()
    expect(verifySession(v, 'other', 1_000)).toBeNull()
    const [payload, sig] = v.split('.')
    const forged = Buffer.from(JSON.stringify({ w: 'main', r: 'admin', e: 2_000 })).toString(
      'base64url',
    )
    expect(verifySession(`${forged}.${sig}`, 'secret', 1_000)).toBeNull()
    expect(verifySession(`${payload}.`, 'secret', 1_000)).toBeNull()
  })
})

describe('HubSpot CRM', () => {
  const lead: Lead = {
    id: 'l1',
    createdAt: '2026-10-26T09:00:00.000Z',
    campaignId: 'c1',
    accountId: 'a1',
    visitorId: 'v1',
    name: 'Asha Rao',
    email: 'asha@northstar.example',
    company: 'Northstar Port Authority',
    role: 'Head of Security',
    message: null,
    pageUrl: 'https://pageforge.example/demo/northstar-abc',
    utm: { source: 'email', campaign: 'abm-northstar' },
    crmProvider: 'hubspot',
    crmId: null,
    crmStatus: 'pending',
    crmError: null,
  }

  function mock(handler: (url: string, body: unknown, method: string) => Response) {
    const calls: { url: string; method: string; body: unknown; auth: string }[] = []
    const fetch = vi.fn<FetchLike>(async (url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body,
        auth: (init?.headers as Record<string, string>).authorization ?? '',
      })
      return handler(url, body, init?.method ?? 'GET')
    })
    return { fetch, calls }
  }

  it('upserts company by domain, contact by email, associates and adds a note', async () => {
    const { fetch, calls } = mock((url) => {
      if (url.endsWith('/companies/search')) return Response.json({ total: 0, results: [] })
      if (url.endsWith('/companies')) return Response.json({ id: '901' }, { status: 201 })
      if (url.endsWith('/contacts/batch/upsert'))
        return Response.json({ status: 'COMPLETE', results: [{ id: '501' }] })
      if (url.includes('/associations/default/')) return Response.json({})
      if (url.endsWith('/notes')) return Response.json({ id: '7001' }, { status: 201 })
      return new Response('nope', { status: 404 })
    })
    const client = createHubSpotClient(fakeHubSpotToken('1'), fetch)
    const note = leadNote({
      lead,
      campaignLabel: 'Northstar Port Authority (demo)',
      engagement: '2 page view(s)',
    })
    const r = await syncLeadToHubSpot(client, {
      lead,
      domain: 'northstar.example',
      companyName: 'Northstar Port Authority',
      note,
      now: new Date('2026-10-26T09:00:00Z'),
    })
    expect(r).toEqual({ crmId: '501', crmStatus: 'synced', crmError: null })
    const v = `${HUBSPOT_API}/crm/objects/2026-09`
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST ${v}/companies/search`,
      `POST ${v}/companies`,
      `POST ${v}/contacts/batch/upsert`,
      `PUT ${v}/contacts/501/associations/default/companies/901`,
      `POST ${v}/notes`,
    ])
    expect(calls[0]!.auth).toBe(`Bearer ${fakeHubSpotToken('1')}`)
    expect(calls[0]!.body).toMatchObject({
      filterGroups: [
        { filters: [{ propertyName: 'domain', operator: 'EQ', value: 'northstar.example' }] },
      ],
    })
    expect(calls[2]!.body).toEqual({
      inputs: [
        {
          id: 'asha@northstar.example',
          idProperty: 'email',
          properties: {
            email: 'asha@northstar.example',
            firstname: 'Asha',
            lastname: 'Rao',
            company: 'Northstar Port Authority',
            jobtitle: 'Head of Security',
          },
        },
      ],
    })
    const noteBody = calls[4]!.body as {
      properties: Record<string, string>
      associations: { types: { associationTypeId: number }[] }[]
    }
    expect(noteBody.properties.hs_timestamp).toBe('2026-10-26T09:00:00.000Z')
    expect(noteBody.properties.hs_note_body).toContain('UTM: source=email, campaign=abm-northstar')
    expect(noteBody.properties.hs_note_body).toContain(lead.pageUrl)
    expect(noteBody.associations.map((a) => a.types[0]!.associationTypeId)).toEqual([202, 190])
  })

  it('reuses an existing company and records failures without throwing (redacted)', async () => {
    const token = fakeHubSpotToken('a')
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = token
    const { fetch, calls } = mock((url) => {
      if (url.endsWith('/companies/search')) return Response.json({ results: [{ id: '42' }] })
      return Response.json(
        { message: `Authentication credentials not found for ${token}` },
        { status: 401 },
      )
    })
    const r = await syncLeadToHubSpot(createHubSpotClient(token, fetch), {
      lead,
      domain: 'northstar.example',
      companyName: 'N',
      note: 'n',
    })
    expect(calls).toHaveLength(2)
    expect(r.crmStatus).toBe('failed')
    expect(r.crmId).toBeNull()
    expect(r.crmError).toContain('HTTP 401')
    expect(r.crmError).not.toContain(token)
  })

  it('syncs a public lead in the background and keeps it when HubSpot fails', async () => {
    const { campaigns, drain, runtime } = await seededDemo()
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = fakeHubSpotToken('9')
    runtime.fetch = async () => new Response('{"message":"down"}', { status: 503 })
    const demo = campaigns.find((c) => c.type === 'demo')!
    const res = await postLead(
      req('/api/abm/leads', {
        body: {
          campaignId: demo.id,
          visitorId: 'visitor_crm_1',
          fields: { name: 'Jo', email: 'jo@x.example', company: 'X' },
        },
        ip: '192.0.2.60',
      }),
    )
    const { leadId } = (await res.json()) as { leadId: string }
    expect((await runtime.store.getLead(leadId))?.crmStatus).toBe('pending')
    await drain()
    const stored = await runtime.store.getLead(leadId)
    expect(stored).toMatchObject({ crmProvider: 'hubspot', crmStatus: 'failed' })
    expect(stored?.crmError).toContain('HTTP 503')
  })
})

describe('robots.txt for the fetcher', () => {
  it('lets PageForgeBot read /fictional while search engines stay out', async () => {
    const { default: robots } = await import('@/app/robots')
    const { parseRobots, robotsAllows } = await import('../robots')
    const r = robots()
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules]
    const text = rules
      .map((g) =>
        [
          ...[g.userAgent].flat().map((a) => `User-agent: ${a}`),
          ...[g.allow ?? []].flat().map((p) => `Allow: ${p}`),
          ...[g.disallow ?? []].flat().map((p) => `Disallow: ${p}`),
        ].join('\n'),
      )
      .join('\n\n')
    const parsed = parseRobots(text)
    expect(robotsAllows(parsed, '/fictional/northstar-port-authority/about')).toBe(true)
    expect(robotsAllows(parsed, '/fictional/northstar-port-authority', 'Googlebot')).toBe(false)
    expect(robotsAllows(parsed, '/abm')).toBe(false)
  })
})

describe('booking and publish options', () => {
  it('gives a lead created from a booking the UTM of the visitor’s earlier visit', async () => {
    const { campaigns, runtime } = await seededDemo()
    const demo = campaigns.find((c) => c.type === 'demo')!
    await events(
      req('/api/abm/events', {
        body: {
          campaignId: demo.id,
          versionId: demo.publishedVersionId,
          pageKind: 'account',
          path: '/demo/x',
          visitorId: 'visitor_utm_1',
          type: 'page_view',
          props: { referrer: 'mail.example' },
          utm: { source: 'linkedin', medium: 'social', campaign: 'abm-x' },
        },
      }),
    )
    const slot = availableSlots(runtime.now())[5]!
    const res = await meetings(
      req('/api/abm/meetings', {
        body: {
          campaignId: demo.id,
          visitorId: 'visitor_utm_1',
          slotStart: slot,
          timezone: 'Asia/Kolkata',
          name: 'Ravi K',
          email: 'ravi@x.example',
          company: 'X',
        },
        ip: '192.0.2.70',
      }),
    )
    const { leadId } = (await res.json()) as { leadId: string }
    expect((await runtime.store.getLead(leadId))?.utm).toEqual({
      source: 'linkedin',
      medium: 'social',
      campaign: 'abm-x',
    })
  })

  it('accepts an explicit expiry date on publish', async () => {
    const { campaigns, runtime } = await seededDemo()
    const { publish } = await import('../service')
    const sol = campaigns.find((c) => c.type === 'solutions')!
    const actor = { workspace: 'demo' as const, role: 'marketer' as const }
    const at = new Date(runtime.now().getTime() + 30 * 86_400_000).toISOString()
    await publish(actor, sol.id, sol.publishedVersionId!, { expiresAt: at })
    expect((await runtime.store.getCampaign(sol.id))?.expiresAt).toBe(at)
    await expect(
      publish(actor, sol.id, sol.publishedVersionId!, { expiresAt: '2020-01-01' }),
    ).rejects.toThrow(/future/)
    await publish(actor, sol.id, sol.publishedVersionId!, { expiresAt: null })
    expect((await runtime.store.getCampaign(sol.id))?.expiresAt).toBeNull()
  })
})
