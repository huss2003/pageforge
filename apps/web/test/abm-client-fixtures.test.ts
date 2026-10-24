import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/abm/client'
import { northstarBrief } from '@/components/abm/brief-form'

/**
 * Fixture mode answers every call from lib/abm/fixtures.ts. This walks the
 * portfolio demo script (spec §10) through the typed client.
 */
describe('client fixture mode', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_ABM_FIXTURES', '1')
    api.setFixtureLatency(0)
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })
  beforeEach(() => api.resetFixtures())

  it('is off unless the flag is set', () => {
    vi.stubEnv('NEXT_PUBLIC_ABM_FIXTURES', '')
    expect(api.fixturesEnabled()).toBe(false)
    vi.stubEnv('NEXT_PUBLIC_ABM_FIXTURES', '1')
    expect(api.fixturesEnabled()).toBe(true)
  })

  it('needs a session for the desk', async () => {
    expect(await api.getSession()).toBeNull()
    await expect(api.listCampaigns()).rejects.toMatchObject({ status: 401 })
    await api.startSession({ role: 'marketer', workspace: 'demo' })
    expect(await api.getSession()).toEqual({
      workspace: 'demo',
      role: 'marketer',
      liveModels: false,
    })
    expect((await api.listCampaigns()).length).toBeGreaterThan(0)
  })

  it('returns field errors for a bad brief', async () => {
    await api.startSession({ role: 'marketer', workspace: 'demo' })
    const err = await api
      .createCampaign({ ...northstarBrief('http://localhost:3000'), companyUrl: 'nope' })
      .catch((e) => e)
    expect(err).toBeInstanceOf(api.ApiError)
    expect(err.status).toBe(400)
    expect(err.fields.companyUrl).toBeTruthy()
  })

  it('runs the demo script: brief, sources, draft, review, publish, engagement', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      await api.startSession({ role: 'marketer', workspace: 'demo' })
      const { campaignId } = await api.createCampaign(northstarBrief('http://localhost:3000'))

      const { sources, facts } = await api.gatherSources(campaignId)
      expect(sources.some((s) => s.status === 'robots_disallowed' && s.detail)).toBe(true)
      expect(facts.find((f) => f.quote.includes('four container terminals'))).toBeTruthy()

      await api.generateDraft(campaignId)
      expect((await api.getCampaign(campaignId)).status).toBe('generating')
      vi.setSystemTime(Date.now() + 10_000)
      const drafted = await api.getCampaign(campaignId)
      expect(drafted.status).toBe('in_review')
      const v = drafted.current!
      const staffing = v.claims.find((c) => c.text.includes('40%'))!
      expect(staffing.status).toBe('needs_review')
      expect(v.publishBlockers.join(' ')).toMatch(/claims? needs? review/)

      // Marketers cannot review claims.
      await expect(api.reviewClaim(staffing.id, 'rejected', 'x')).rejects.toMatchObject({
        status: 403,
      })

      await api.startSession({ role: 'reviewer', workspace: 'demo' })
      await expect(api.reviewClaim(staffing.id, 'rejected')).rejects.toMatchObject({ status: 400 })
      let next = await api.reviewClaim(
        staffing.id,
        'rejected',
        'No approved fact for staffing costs.',
      )
      const stats = next.page.blocks.find((b) => b._key === 'stats') as {
        stats: { value: string }[]
      }
      expect(stats.stats.map((s) => s.value)).not.toContain('40')
      for (const c of next.claims.filter((c) => c.status === 'needs_review')) {
        next = await api.reviewClaim(c.id, 'supported')
      }
      expect(next.publishBlockers).toEqual([])
      const approved = await api.approveVersion(next.id)
      expect(approved.state).toBe('approved')

      await expect(api.publishCampaign(campaignId, next.id)).rejects.toMatchObject({ status: 403 })
      await api.startSession({ role: 'marketer', workspace: 'demo' })
      const { liveUrl } = await api.publishCampaign(campaignId, next.id)
      // Same slug and token as the public route stub serves, so the link opens.
      expect(liveUrl).toMatch(/\/demo\/northstar-port-authority-k7q2m9x4p1za$/)

      // As a prospect.
      await api.request('POST', '/api/abm/events', {
        campaignId,
        versionId: next.id,
        pageKind: 'account',
        path: '/demo/northstar-port-authority',
        visitorId: 'visitor0001',
        type: 'page_view',
      })
      const slots = await api.getSlots(campaignId)
      expect(slots.length).toBeGreaterThan(20)
      await api.bookMeeting({
        campaignId,
        visitorId: 'visitor0001',
        slotStart: slots[0]!,
        timezone: 'Europe/London',
        name: 'Rosa Lindqvist',
        email: 'rosa@northstar.example',
        company: 'Northstar Port Authority',
      })
      await api.request('POST', '/api/abm/events', {
        campaignId,
        versionId: next.id,
        pageKind: 'account',
        path: '/demo/northstar-port-authority',
        visitorId: 'visitor0001',
        type: 'meeting_booked',
        props: { slot: slots[0]! },
      })
      expect(await api.getSlots(campaignId)).not.toContain(slots[0])

      const eng = await api.getEngagement(campaignId)
      expect(eng).toMatchObject({ views: 1, meetings: 1, visitors: 1 })
      const leads = await api.listLeads()
      expect(leads.find((l) => l.campaignId === campaignId)?.company).toBe(
        'Northstar Port Authority',
      )
      const audit = await api.getAudit(campaignId)
      expect(audit.map((a) => a.action)).toEqual(
        expect.arrayContaining([
          'brief.created',
          'claim.rejected',
          'version.approved',
          'campaign.published',
        ]),
      )
      expect(audit.find((a) => a.action === 'claim.rejected')?.actorRole).toBe('reviewer')
    } finally {
      vi.useRealTimers()
    }
  })

  it('edits an approved version into a new draft', async () => {
    await api.startSession({ role: 'marketer', workspace: 'demo' })
    const live = (await api.listCampaigns()).find((c) => c.status === 'published' && c.accountName)!
    const detail = await api.getCampaign(live.id)
    const edited = await api.editVersion(detail.current!.id, [
      { blockKey: 'hero', field: 'heading', value: 'A new heading' },
    ])
    expect(edited.id).not.toBe(detail.current!.id)
    expect(edited.origin).toBe('edit')
    expect(edited.number).toBe(detail.current!.number + 1)
    expect((await api.getCampaign(live.id)).publishedVersionId).toBe(detail.publishedVersionId)
  })
})
