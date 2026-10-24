import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { redactSecrets } from '@/lib/env'
import type { AuditEntry, Claim, Lead, Meeting } from './types'
import type { AbmStore, NewClaim, SourceRecord, StoredEvent } from './store'

/**
 * Supabase implementation of AbmStore over the pf_abm_* tables
 * (supabase/migrations/0002_abm.sql), using the server-only secret key.
 *
 * Row ↔ object mapping converts top-level keys between snake_case and
 * camelCase; jsonb values (page, seo, cta, sources, props …) are kept as is.
 * Two fields have no column of their own:
 *  - Claim.origin is stored inside the `validator` jsonb,
 *  - Lead.illustrative is stored as utm.illustrative = "true".
 */
type Row = Record<string, unknown>

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
const TIMESTAMPS = new Set([
  'createdAt',
  'updatedAt',
  'fetchedAt',
  'publishedAt',
  'briefAt',
  'reviewReadyAt',
  'expiresAt',
  'approvedAt',
  'reviewedAt',
  'slotStart',
])

function toRow(obj: object): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[snake(k)] = v
  return out
}

function fromRow<T>(row: Row): T {
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) {
    const key = camel(k)
    out[key] = TIMESTAMPS.has(key) && typeof v === 'string' ? new Date(v).toISOString() : v
  }
  return out as T
}

function claimToRow(c: NewClaim & { versionId?: string }): Row {
  const { origin, validator, ...rest } = c
  return toRow({ ...rest, validator: { ...validator, ...(origin ? { origin } : {}) } })
}

function claimFromRow(row: Row): Claim {
  const c = fromRow<Claim & { validator: Claim['validator'] & { origin?: Claim['origin'] } }>(row)
  const { origin, ...validator } = c.validator ?? { ok: false, reasons: [] }
  return { ...c, validator, ...(origin ? { origin } : {}) }
}

function leadToRow(l: Partial<Lead>): Row {
  const { illustrative, ...rest } = l
  const row = toRow(rest)
  if (illustrative) row.utm = { ...(l.utm ?? {}), illustrative: 'true' }
  return row
}

function leadFromRow(row: Row): Lead {
  const l = fromRow<Lead>(row)
  return l.utm?.illustrative === 'true' ? { ...l, illustrative: true } : l
}

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

function fail(what: string, error: { message: string; code?: string } | null): void {
  if (error) throw new Error(`Supabase ${what} failed: ${redactSecrets(error.message)}`)
}

export function createSupabaseStore(db: SupabaseClient): AbmStore {
  const t = (name: string) => db.from(`pf_abm_${name}`)

  async function one<T>(name: string, id: string, map: (r: Row) => T = fromRow): Promise<T | null> {
    if (!isUuid(id)) return null
    const { data, error } = await t(name).select('*').eq('id', id).maybeSingle()
    fail(`get ${name}`, error)
    return data ? map(data as Row) : null
  }

  async function insert<T>(name: string, row: Row, map: (r: Row) => T = fromRow): Promise<T> {
    const { data, error } = await t(name).insert(row).select('*').single()
    fail(`insert ${name}`, error)
    return map(data as Row)
  }

  async function update<T>(name: string, id: string, row: Row, map: (r: Row) => T = fromRow) {
    const { data, error } = await t(name).update(row).eq('id', id).select('*').single()
    fail(`update ${name}`, error)
    return map(data as Row)
  }

  return {
    kind: 'supabase',

    createAccount: (input) => insert('accounts', toRow(input)),
    getAccount: (id) => one('accounts', id),

    createCampaign: (input) => insert('campaigns', toRow(input)),
    getCampaign: (id) => one('campaigns', id),
    updateCampaign: (id, patch) => update('campaigns', id, toRow(patch)),
    async listCampaigns(workspace, opts) {
      let q = t('campaigns').select('*').eq('workspace', workspace)
      if (opts?.since) q = q.gte('created_at', opts.since.toISOString())
      const { data, error } = await q.order('updated_at', { ascending: false }).limit(500)
      fail('listCampaigns', error)
      return (data ?? []).map((r) => fromRow(r as Row))
    },
    async findCampaigns(qry) {
      let q = t('campaigns').select('*')
      if (qry.type) q = q.eq('type', qry.type)
      if (qry.slug) q = q.eq('slug', qry.slug)
      if (qry.industry) q = q.eq('industry', qry.industry)
      if (qry.status) q = q.in('status', qry.status)
      if (qry.workspace) q = q.eq('workspace', qry.workspace)
      const { data, error } = await q.order('updated_at', { ascending: false }).limit(200)
      fail('findCampaigns', error)
      return (data ?? []).map((r) => fromRow(r as Row))
    },

    async replaceSources(accountId, items) {
      const del = await t('sources').delete().eq('account_id', accountId)
      fail('delete sources', del.error)
      const sources: SourceRecord[] = []
      const facts = []
      for (const item of items) {
        const s = await insert<SourceRecord>('sources', toRow({ ...item.source, accountId }))
        sources.push(s)
        if (item.facts.length) {
          const { data, error } = await t('source_facts')
            .insert(
              item.facts.map((f) => toRow({ ...f, sourceId: s.id, accountId })),
              {
                // Rows that omit a column (e.g. a new claim's id) get its default, not null.
                defaultToNull: false,
              },
            )
            .select('*')
          fail('insert source facts', error)
          facts.push(...(data ?? []).map((r) => fromRow<import('./types').SourceFact>(r as Row)))
        }
      }
      return { sources, facts }
    },
    async listSources(accountId) {
      const { data, error } = await t('sources')
        .select('*')
        .eq('account_id', accountId)
        .order('fetched_at')
      fail('listSources', error)
      return (data ?? []).map((r) => fromRow(r as Row))
    },
    async listFacts(accountId) {
      const { data, error } = await t('source_facts').select('*').eq('account_id', accountId)
      fail('listFacts', error)
      return (data ?? []).map((r) => fromRow(r as Row))
    },
    async setFactIncluded(accountId, factId, included) {
      if (!isUuid(factId)) return null
      const { data, error } = await t('source_facts')
        .update({ included })
        .eq('id', factId)
        .eq('account_id', accountId)
        .select('*')
        .maybeSingle()
      fail('setFactIncluded', error)
      return data ? fromRow(data as Row) : null
    },

    async createVersion(input, claims) {
      const version = await insert<import('./types').Version>('versions', toRow(input))
      let out: Claim[] = []
      if (claims.length) {
        const { data, error } = await t('claims')
          .insert(
            claims.map((c) => claimToRow({ ...c, versionId: version.id })),
            {
              // Rows that omit a column (e.g. a new claim's id) get its default, not null.
              defaultToNull: false,
            },
          )
          .select('*')
        fail('insert claims', error)
        out = (data ?? []).map((r) => claimFromRow(r as Row))
      }
      return { version, claims: out }
    },
    getVersion: (id) => one('versions', id),
    updateVersion: (id, patch) => update('versions', id, toRow(patch)),
    async deleteVersion(id) {
      const { error } = await t('versions').delete().eq('id', id)
      fail('deleteVersion', error)
    },
    async listVersions(campaignId) {
      const { data, error } = await t('versions')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('number')
      fail('listVersions', error)
      return (data ?? []).map((r) => fromRow(r as Row))
    },

    async listClaims(versionId) {
      const { data, error } = await t('claims').select('*').eq('version_id', versionId)
      fail('listClaims', error)
      return (data ?? []).map((r) => claimFromRow(r as Row))
    },
    async listClaimsForVersions(ids) {
      if (!ids.length) return []
      const { data, error } = await t('claims').select('*').in('version_id', ids)
      fail('listClaimsForVersions', error)
      return (data ?? []).map((r) => claimFromRow(r as Row))
    },
    getClaim: (id) => one('claims', id, claimFromRow),
    async updateClaim(id, patch) {
      const current = await one('claims', id, claimFromRow)
      if (!current) throw new Error(`Claim ${id} not found`)
      return update('claims', id, claimToRow({ ...current, ...patch }), claimFromRow)
    },
    async replaceClaims(versionId, claims) {
      // Write first, prune after: a failed write must never leave the version
      // without its claims (they carry the sources the reviewer checked).
      let kept: Claim[] = []
      if (claims.length) {
        const { data, error } = await t('claims')
          .upsert(
            claims.map((c) => claimToRow({ ...c, versionId })),
            // Rows that omit a column (a new claim's id) get its default, not null.
            { onConflict: 'id', defaultToNull: false },
          )
          .select('*')
        fail('replaceClaims', error)
        kept = (data ?? []).map((r) => claimFromRow(r as Row))
      }
      const keepIds = kept.map((c) => c.id).filter(isUuid)
      let del = t('claims').delete().eq('version_id', versionId)
      if (keepIds.length) del = del.not('id', 'in', `(${keepIds.join(',')})`)
      const { error: delError } = await del
      fail('prune claims', delError)
      return kept
    },

    async addEvents(events) {
      if (!events.length) return
      const { error } = await t('events').insert(
        events.map((e) => toRow({ ...e, props: e.props ?? {}, utm: e.utm ?? {} })),
        { defaultToNull: false },
      )
      fail('addEvents', error)
    },
    async listEvents(qry) {
      let q = t('events').select('*')
      if (qry.campaignIds && qry.withoutCampaign) {
        const ids = qry.campaignIds.filter(isUuid)
        q = ids.length
          ? q.or(`campaign_id.is.null,campaign_id.in.(${ids.join(',')})`)
          : q.is('campaign_id', null)
      } else if (qry.campaignIds) {
        const ids = qry.campaignIds.filter(isUuid)
        if (!ids.length) return []
        q = q.in('campaign_id', ids)
      } else if (qry.withoutCampaign) q = q.is('campaign_id', null)
      if (qry.pageKind) q = q.eq('page_kind', qry.pageKind)
      if (qry.since) q = q.gte('created_at', qry.since.toISOString())
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(qry.limit ?? 5000)
      fail('listEvents', error)
      return (data ?? []).map((r) => fromRow<StoredEvent>(r as Row)).reverse()
    },

    createLead: (input) => insert('leads', leadToRow(input), leadFromRow),
    getLead: (id) => one('leads', id, leadFromRow),
    updateLead: (id, patch) => update('leads', id, toRow(patch), leadFromRow),
    async listLeads(ids, opts) {
      const valid = ids.filter(isUuid)
      if (!valid.length && !opts?.withoutCampaign) return []
      let q = t('leads').select('*')
      if (opts?.withoutCampaign)
        q = valid.length
          ? q.or(`campaign_id.is.null,campaign_id.in.(${valid.join(',')})`)
          : q.is('campaign_id', null)
      else q = q.in('campaign_id', valid)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
      fail('listLeads', error)
      return (data ?? []).map((r) => leadFromRow(r as Row))
    },
    async findLeadByEmail(campaignId, email) {
      if (!isUuid(campaignId)) return null
      const { data, error } = await t('leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .ilike('email', email.replace(/[%_\\]/g, '\\$&'))
        .order('created_at', { ascending: false })
        .limit(1)
      fail('findLeadByEmail', error)
      return data?.[0] ? leadFromRow(data[0] as Row) : null
    },

    async createMeeting(input) {
      const { data, error } = await t('meetings').insert(toRow(input)).select('*').single()
      // Unique index (campaign_id, slot_start): a double booking is a conflict, not an error.
      if (error && (error.code === '23505' || /duplicate key/i.test(error.message))) return null
      fail('createMeeting', error)
      return fromRow<Meeting>(data as Row)
    },
    async listMeetings(ids) {
      const valid = ids.filter(isUuid)
      if (!valid.length) return []
      const { data, error } = await t('meetings')
        .select('*')
        .in('campaign_id', valid)
        .order('slot_start')
      fail('listMeetings', error)
      return (data ?? []).map((r) => fromRow(r as Row))
    },

    async audit(entry) {
      const { error } = await t('audit').insert(toRow({ ...entry, detail: entry.detail ?? {} }))
      fail('audit', error)
    },
    async listAudit(campaignId) {
      if (!isUuid(campaignId)) return []
      const { data, error } = await t('audit')
        .select('id, created_at, campaign_id, actor_role, action, detail')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(500)
      fail('listAudit', error)
      return (data ?? []).map((r) => fromRow<AuditEntry>(r as Row))
    },

    async hitRateLimit(key, limit) {
      const { data, error } = await db.rpc('pf_hit_rate_limit', {
        p_key: `abm:${key}`,
        p_limit: limit,
      })
      fail('hitRateLimit', error)
      return data === true
    },

    async purgeDemo(before) {
      const iso = before.toISOString()
      const c = await t('campaigns')
        .delete({ count: 'exact' })
        .eq('workspace', 'demo')
        .lt('created_at', iso)
      fail('purge campaigns', c.error)
      const a = await t('accounts').delete().eq('workspace', 'demo').lt('created_at', iso)
      fail('purge accounts', a.error)
      const au = await t('audit').delete().eq('workspace', 'demo').lt('created_at', iso)
      fail('purge audit', au.error)
      return c.count ?? 0
    },
  }
}
