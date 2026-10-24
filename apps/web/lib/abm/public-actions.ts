import 'server-only'
import { engagementSummary } from './analytics'
import { availableSlots, isOfferedSlot } from './calendar'
import { getAbmConfig } from './config'
import {
  addMeetingNoteToHubSpot,
  companyDomain,
  createHubSpotClient,
  engagementLine,
  leadNote,
  syncLeadToHubSpot,
} from './crm'
import { AbmError } from './http'
import { absolute, publicPath } from './paths'
import { getAbmRuntime } from './runtime'
import { expireIfDue } from './service'
import type { Campaign, Lead, TrackEvent } from './types'

/**
 * Public actions from account pages: events (beacon), leads, calendar
 * slots and meetings. Callers have already validated the body, checked
 * Turnstile and the per-IP limits.
 *
 * Every event, including `form_submit` and `meeting_booked`, comes from the
 * page's tracker (sendBeacon) with the props the timeline reads; leads and
 * meetings are stored here without adding events, so nothing counts twice.
 */

const rt = () => getAbmRuntime()

/** A campaign that accepts public traffic: published (paused/expired pages take nothing). */
async function liveCampaign(id: string | null): Promise<Campaign | null> {
  if (!id) return null
  const c = await rt().store.getCampaign(id)
  if (!c) return null
  const fresh = await expireIfDue(c)
  return fresh.status === 'published' ? fresh : null
}

export type EventOutcome = 'stored' | 'dropped' | 'rate_limited'

export async function recordEvent(event: TrackEvent): Promise<EventOutcome> {
  const { store, now } = rt()
  const minute = Math.floor(now().getTime() / 60_000)
  const allowed = await store.hitRateLimit(
    `ev:${event.visitorId}:${minute}`,
    getAbmConfig().limits.eventsPerVisitorPerMinute,
  )
  if (!allowed) return 'rate_limited'
  if (event.campaignId) {
    const c = await liveCampaign(event.campaignId)
    if (!c) return 'dropped'
    const kind = c.type === 'solutions' ? 'generic' : 'account'
    if (event.pageKind !== kind) return 'dropped'
    if (event.versionId && event.versionId !== c.publishedVersionId)
      event = { ...event, versionId: c.publishedVersionId }
  } else if (event.pageKind !== 'generic') return 'dropped'
  // Only the seed may flag data as illustrative.
  const props = { ...event.props }
  delete props.illustrative
  await store.addEvents([{ ...event, props, createdAt: now().toISOString() }])
  return 'stored'
}

function pageUrlFor(c: Campaign | null, given?: string): string {
  if (c) {
    const path = publicPath(c)
    if (path) return absolute(getAbmConfig().siteUrl, path)
  }
  if (given) {
    try {
      const u = new URL(given)
      if (u.origin === new URL(getAbmConfig().siteUrl).origin) return `${u.origin}${u.pathname}`
    } catch {
      // ignore
    }
  }
  return getAbmConfig().siteUrl
}

async function campaignLabel(
  c: Campaign | null,
): Promise<{ label: string; domain: string | null; name: string | null }> {
  if (!c) return { label: 'Generic page', domain: null, name: null }
  const account = c.accountId ? await rt().store.getAccount(c.accountId) : null
  return {
    label: `${account?.name ?? `Solutions: ${c.industry}`} (${c.type}, ${c.utmCampaign})`,
    domain: account?.domain ?? null,
    name: account?.name ?? null,
  }
}

async function engagementText(
  campaignId: string | null,
  visitorId: string | null,
): Promise<string> {
  if (!campaignId || !visitorId) return 'no tracked visits'
  const events = (await rt().store.listEvents({ campaignIds: [campaignId] })).filter(
    (e) => e.visitorId === visitorId,
  )
  return engagementLine(engagementSummary(campaignId, events, [], rt().now()))
}

/** Push a lead to HubSpot in the background; the built-in lead is already stored. */
function scheduleCrmSync(lead: Lead, campaign: Campaign | null, meetingAt?: string | null) {
  const token = getAbmConfig().hubspotToken
  if (!token) return
  rt().schedule(async () => {
    const { store } = rt()
    lead = (await store.getLead(lead.id)) ?? lead
    const client = createHubSpotClient(token, rt().fetch)
    const label = await campaignLabel(campaign)
    const note = leadNote({
      lead,
      campaignLabel: label.label,
      engagement: await engagementText(lead.campaignId, lead.visitorId),
      meetingAt,
    })
    if (meetingAt && lead.crmId && lead.crmStatus === 'synced') {
      const r = await addMeetingNoteToHubSpot(client, {
        contactId: lead.crmId,
        note,
        now: rt().now(),
      })
      if (!r.ok) await store.updateLead(lead.id, { crmStatus: 'failed', crmError: r.error })
      return
    }
    const r = await syncLeadToHubSpot(client, {
      lead,
      domain: companyDomain(label.domain, lead.email),
      companyName: label.name ?? lead.company,
      note,
      now: rt().now(),
    })
    await store.updateLead(lead.id, r)
  })
}

export interface LeadInput {
  campaignId: string | null
  versionId?: string | null
  visitorId?: string | null
  fields: {
    name: string
    email: string
    company: string
    role?: string
    phone?: string
    message?: string
    siteCount?: number | string
  }
  utm?: Record<string, string | undefined>
  pageUrl?: string
}

export async function submitLead(
  input: LeadInput,
  opts: { fromMeeting?: boolean } = {},
): Promise<Lead> {
  const { store, now } = rt()
  const campaign = input.campaignId ? await liveCampaign(input.campaignId) : null
  if (input.campaignId && !campaign)
    throw new AbmError(404, 'This page is no longer taking requests.')
  const hubspot = Boolean(getAbmConfig().hubspotToken)
  const extra = [
    input.fields.phone ? `Phone: ${input.fields.phone}` : '',
    input.fields.siteCount ? `Sites: ${input.fields.siteCount}` : '',
  ].filter(Boolean)
  const lead = await store.createLead({
    campaignId: campaign?.id ?? null,
    accountId: campaign?.accountId ?? null,
    visitorId: input.visitorId ?? null,
    name: input.fields.name,
    email: input.fields.email,
    company: input.fields.company,
    role: input.fields.role ?? null,
    message: [input.fields.message ?? '', ...extra].filter(Boolean).join('\n') || null,
    pageUrl: pageUrlFor(campaign, input.pageUrl),
    utm: Object.fromEntries(
      Object.entries(input.utm ?? {}).filter(([, v]) => typeof v === 'string'),
    ) as Record<string, string>,
    crmProvider: hubspot ? 'hubspot' : 'builtin',
    crmId: null,
    crmStatus: hubspot ? 'pending' : 'synced',
    crmError: null,
    createdAt: now().toISOString(),
  })
  if (campaign) {
    await store.audit({
      workspace: campaign.workspace,
      campaignId: campaign.id,
      actorRole: 'system',
      action: 'lead.created',
      detail: { company: lead.company, leadId: lead.id, crm: lead.crmProvider },
    })
  }
  if (!opts.fromMeeting) scheduleCrmSync(lead, campaign)
  return lead
}

export async function slotsFor(campaignId: string | null): Promise<string[]> {
  const { store, now } = rt()
  const booked = campaignId ? (await store.listMeetings([campaignId])).map((m) => m.slotStart) : []
  return availableSlots(now(), booked)
}

export interface MeetingInput {
  campaignId: string | null
  leadId?: string | null
  visitorId?: string | null
  slotStart: string
  timezone: string
  name: string
  email: string
  company: string
  utm?: Record<string, string | undefined>
  pageUrl?: string
}

export async function bookMeeting(input: MeetingInput) {
  const { store, now } = rt()
  const campaign = input.campaignId ? await liveCampaign(input.campaignId) : null
  if (input.campaignId && !campaign)
    throw new AbmError(404, 'This page is no longer taking bookings.')
  if (!isValidTimeZone(input.timezone))
    throw new AbmError(422, 'Unknown time zone.', { fields: { timezone: 'Unknown time zone.' } })
  const booked = campaign ? (await store.listMeetings([campaign.id])).map((m) => m.slotStart) : []
  const slot = isOfferedSlot(input.slotStart, now(), booked)
  if (!slot) throw new AbmError(409, 'That time is no longer available. Pick another slot.')

  let lead: Lead | null = null
  if (input.leadId) {
    lead = await store.getLead(input.leadId)
    if (!lead || lead.campaignId !== (campaign?.id ?? null))
      throw new AbmError(404, 'Lead not found for this page.')
  } else if (campaign) {
    lead = await store.findLeadByEmail(campaign.id, input.email)
  }
  if (!lead) {
    // A booking without a form: carry the UTM of the visitor's earlier visit.
    let utm = input.utm
    if ((!utm || !Object.keys(utm).length) && input.visitorId && campaign) {
      const earlier = (await store.listEvents({ campaignIds: [campaign.id] }))
        .filter((e) => e.visitorId === input.visitorId && Object.keys(e.utm ?? {}).length)
        .at(-1)
      if (earlier) utm = { ...earlier.utm }
    }
    lead = await submitLead(
      {
        campaignId: campaign?.id ?? null,
        visitorId: input.visitorId,
        fields: { name: input.name, email: input.email, company: input.company },
        utm,
        pageUrl: input.pageUrl,
      },
      { fromMeeting: true },
    )
  }
  const meeting = await store.createMeeting({
    campaignId: campaign?.id ?? null,
    leadId: lead.id,
    slotStart: slot,
    timezone: input.timezone,
    createdAt: now().toISOString(),
  })
  if (!meeting)
    throw new AbmError(409, 'That time was just booked by someone else. Pick another slot.')
  if (campaign) {
    await store.audit({
      workspace: campaign.workspace,
      campaignId: campaign.id,
      actorRole: 'system',
      action: 'meeting.booked',
      detail: { slot, timezone: input.timezone, meetingId: meeting.id, leadId: lead.id },
    })
  }
  // A lead not yet in HubSpot is synced with a meeting note; a synced one gets a meeting note.
  scheduleCrmSync(lead, campaign, slot)
  return { meeting, lead }
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
