import { safeErrorMessage } from '@/lib/env'
import type { EngagementSummary, Lead } from './types'

/**
 * CRM sync. The built-in CRM (pf_abm_leads, or memory) always holds the
 * lead. When HUBSPOT_PRIVATE_APP_TOKEN is set, leads are also pushed to
 * HubSpot over the CRM REST API (date-versioned paths, which replace the
 * /crm/v3/ paths; v3 stays supported until September 2027):
 *
 *   company   POST /crm/objects/2026-09/companies/search (domain EQ) → create if missing
 *   contact   POST /crm/objects/2026-09/contacts/batch/upsert (idProperty: email)
 *   associate PUT  /crm/objects/2026-09/contacts/{id}/associations/default/companies/{companyId}
 *   note      POST /crm/objects/2026-09/notes (associationTypeId 202 → contact, 190 → company)
 *
 * A failed sync never loses the lead: it is stored with crmStatus "failed"
 * and a redacted error.
 */
export const HUBSPOT_API = 'https://api.hubapi.com'
export const HUBSPOT_VERSION = '2026-09'
const NOTE_TO_CONTACT = 202
const NOTE_TO_COMPANY = 190

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class HubSpotError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'HubSpotError'
  }
}

export interface HubSpotClient {
  upsertCompany(input: { domain: string; name: string }): Promise<string>
  upsertContact(input: {
    email: string
    firstname: string
    lastname: string
    company: string
    jobtitle?: string | null
    phone?: string | null
  }): Promise<string>
  associateContactCompany(contactId: string, companyId: string): Promise<void>
  addNote(input: {
    body: string
    contactId: string
    companyId?: string | null
    at?: Date
  }): Promise<string>
}

export function createHubSpotClient(token: string, fetchImpl: FetchLike = fetch): HubSpotClient {
  const path = (p: string) => `${HUBSPOT_API}/crm/objects/${HUBSPOT_VERSION}${p}`
  async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
    let res: Response
    try {
      res = await fetchImpl(url, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      })
    } catch (e) {
      throw new HubSpotError(`HubSpot request failed: ${safeErrorMessage(e, 200)}`)
    }
    const text = await res.text()
    if (!res.ok) {
      let message = text.slice(0, 300)
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? message
      } catch {
        // keep the raw text
      }
      throw new HubSpotError(
        `HubSpot ${method} ${url.replace(HUBSPOT_API, '')} → HTTP ${res.status}: ${message}`,
        res.status,
      )
    }
    return (text ? JSON.parse(text) : {}) as T
  }

  return {
    async upsertCompany({ domain, name }) {
      const found = await call<{ results?: { id: string }[] }>('POST', path('/companies/search'), {
        filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
        properties: ['domain', 'name'],
        limit: 1,
      })
      const id = found.results?.[0]?.id
      if (id) return id
      const created = await call<{ id: string }>('POST', path('/companies'), {
        properties: { domain, name },
      })
      return created.id
    },
    async upsertContact(input) {
      const properties: Record<string, string> = {
        email: input.email,
        firstname: input.firstname,
        lastname: input.lastname,
        company: input.company,
      }
      if (input.jobtitle) properties.jobtitle = input.jobtitle
      if (input.phone) properties.phone = input.phone
      const res = await call<{ results?: { id: string }[] }>(
        'POST',
        path('/contacts/batch/upsert'),
        {
          inputs: [{ id: input.email, idProperty: 'email', properties }],
        },
      )
      const id = res.results?.[0]?.id
      if (!id) throw new HubSpotError('HubSpot upsert returned no contact id')
      return id
    },
    async associateContactCompany(contactId, companyId) {
      await call(
        'PUT',
        path(
          `/contacts/${encodeURIComponent(contactId)}/associations/default/companies/${encodeURIComponent(companyId)}`,
        ),
      )
    },
    async addNote({ body, contactId, companyId, at }) {
      const associations = [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: NOTE_TO_CONTACT }],
        },
        ...(companyId
          ? [
              {
                to: { id: companyId },
                types: [
                  { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: NOTE_TO_COMPANY },
                ],
              },
            ]
          : []),
      ]
      const res = await call<{ id: string }>('POST', path('/notes'), {
        properties: { hs_timestamp: (at ?? new Date()).toISOString(), hs_note_body: body },
        associations,
      })
      return res.id
    },
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function splitName(name: string): { firstname: string; lastname: string } {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return { firstname: parts[0]!, lastname: '' }
  return { firstname: parts.slice(0, -1).join(' '), lastname: parts.at(-1)! }
}

export function engagementLine(
  e: Pick<
    EngagementSummary,
    'views' | 'maxScroll' | 'ctaClicks' | 'formStarts' | 'formSubmits' | 'meetings'
  >,
): string {
  return `${e.views} page view(s), max scroll ${e.maxScroll}%, ${e.ctaClicks} CTA click(s), ${e.formStarts} form start(s), ${e.formSubmits} form submit(s), ${e.meetings} meeting(s)`
}

export function leadNote(input: {
  lead: Lead
  campaignLabel: string
  engagement: string
  meetingAt?: string | null
}): string {
  const utm = Object.entries(input.lead.utm)
    .filter(([k]) => k !== 'illustrative')
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
  const lines = [
    input.meetingAt
      ? `<strong>Meeting booked</strong> for ${escapeHtml(input.meetingAt)} (PageForge demo calendar)`
      : '<strong>PageForge ABM lead</strong>',
    `Campaign: ${escapeHtml(input.campaignLabel)}`,
    `Page: ${escapeHtml(input.lead.pageUrl)}`,
    `UTM: ${escapeHtml(utm || 'none')}`,
    `Engagement: ${escapeHtml(input.engagement)}`,
  ]
  if (input.lead.message) lines.push(`Message: ${escapeHtml(input.lead.message)}`)
  return lines.join('<br>')
}

export interface SyncResult {
  crmId: string | null
  crmStatus: Lead['crmStatus']
  crmError: string | null
}

/** Push a lead to HubSpot: company by domain, contact by email, association and a note. */
export async function syncLeadToHubSpot(
  client: HubSpotClient,
  input: { lead: Lead; domain: string; companyName: string; note: string; now?: Date },
): Promise<SyncResult> {
  try {
    const { firstname, lastname } = splitName(input.lead.name)
    const companyId = await client.upsertCompany({ domain: input.domain, name: input.companyName })
    const contactId = await client.upsertContact({
      email: input.lead.email,
      firstname,
      lastname,
      company: input.lead.company,
      jobtitle: input.lead.role,
    })
    await client.associateContactCompany(contactId, companyId)
    await client.addNote({ body: input.note, contactId, companyId, at: input.now })
    return { crmId: contactId, crmStatus: 'synced', crmError: null }
  } catch (e) {
    return { crmId: null, crmStatus: 'failed', crmError: safeErrorMessage(e, 300) }
  }
}

/** Add a meeting note to an already-synced HubSpot contact. */
export async function addMeetingNoteToHubSpot(
  client: HubSpotClient,
  input: { contactId: string; note: string; now?: Date },
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await client.addNote({ body: input.note, contactId: input.contactId, at: input.now })
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e, 300) }
  }
}

/** Company domain: the account's domain, else the lead's email domain. */
export function companyDomain(accountDomain: string | null | undefined, email: string): string {
  return (accountDomain || email.split('@')[1] || 'unknown.invalid').toLowerCase()
}
