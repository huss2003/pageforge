import { randomUUID } from 'node:crypto'
import type {
  Account,
  AuditEntry,
  Campaign,
  Claim,
  Lead,
  Meeting,
  SourceFact,
  Version,
} from './types'
import type { AbmStore, SourceRecord, StoredEvent } from './store'

const clone = <T>(v: T): T => structuredClone(v)
const utcDay = (d: Date) => d.toISOString().slice(0, 10)

/**
 * In-memory store. State lives on one server instance and resets on a cold
 * start; the UI says so when this store is active (storage: 'memory').
 */
export function createMemoryStore(now: () => Date = () => new Date()): AbmStore {
  const accounts = new Map<string, Account>()
  const campaigns = new Map<string, Campaign>()
  const sources = new Map<string, SourceRecord>()
  const facts = new Map<string, SourceFact>()
  const versions = new Map<string, Version>()
  const claims = new Map<string, Claim>()
  const events: StoredEvent[] = []
  const leads = new Map<string, Lead>()
  const meetings = new Map<string, Meeting>()
  const audit: (AuditEntry & { workspace: string })[] = []
  const limits = new Map<string, number>()
  let eventSeq = 0
  let auditSeq = 0
  const ts = () => now().toISOString()

  const must = <T>(map: Map<string, T>, id: string, what: string): T => {
    const v = map.get(id)
    if (!v) throw new Error(`${what} ${id} not found`)
    return v
  }

  return {
    kind: 'memory',

    async createAccount(input) {
      const a: Account = { ...clone(input), id: randomUUID(), createdAt: input.createdAt ?? ts() }
      accounts.set(a.id, a)
      return clone(a)
    },
    async getAccount(id) {
      const a = accounts.get(id)
      return a ? clone(a) : null
    },

    async createCampaign(input) {
      const t = input.createdAt ?? ts()
      const open = [...campaigns.values()].some(
        (c) =>
          c.workspace === input.workspace &&
          c.type === input.type &&
          c.slug === input.slug &&
          c.status !== 'archived',
      )
      if (open)
        throw new Error(
          'duplicate key value violates unique constraint "pf_abm_campaigns_path_idx"',
        )
      const c: Campaign = { ...clone(input), id: randomUUID(), createdAt: t, updatedAt: t }
      campaigns.set(c.id, c)
      return clone(c)
    },
    async getCampaign(id) {
      const c = campaigns.get(id)
      return c ? clone(c) : null
    },
    async updateCampaign(id, patch) {
      const c = must(campaigns, id, 'Campaign')
      const next = { ...c, ...clone(patch), updatedAt: ts() }
      campaigns.set(id, next)
      return clone(next)
    },
    async listCampaigns(workspace, opts) {
      return [...campaigns.values()]
        .filter((c) => c.workspace === workspace)
        .filter((c) => !opts?.since || Date.parse(c.createdAt) >= opts.since.getTime())
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(clone)
    },
    async findCampaigns(q) {
      return [...campaigns.values()]
        .filter(
          (c) =>
            (!q.type || c.type === q.type) &&
            (!q.slug || c.slug === q.slug) &&
            (!q.industry || c.industry === q.industry) &&
            (!q.status || q.status.includes(c.status)) &&
            (!q.workspace || c.workspace === q.workspace),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(clone)
    },

    async replaceSources(accountId, items) {
      for (const [id, s] of sources) if (s.accountId === accountId) sources.delete(id)
      for (const [id, f] of facts) if (f.accountId === accountId) facts.delete(id)
      const outS: SourceRecord[] = []
      const outF: SourceFact[] = []
      for (const item of items) {
        const s: SourceRecord = { ...clone(item.source), id: randomUUID(), accountId }
        sources.set(s.id, s)
        outS.push(clone(s))
        for (const f of item.facts) {
          const fact: SourceFact = { ...clone(f), id: randomUUID(), sourceId: s.id, accountId }
          facts.set(fact.id, fact)
          outF.push(clone(fact))
        }
      }
      return { sources: outS, facts: outF }
    },
    async listSources(accountId) {
      return [...sources.values()].filter((s) => s.accountId === accountId).map(clone)
    },
    async listFacts(accountId) {
      return [...facts.values()].filter((f) => f.accountId === accountId).map(clone)
    },
    async setFactIncluded(accountId, factId, included) {
      const f = facts.get(factId)
      if (!f || f.accountId !== accountId) return null
      f.included = included
      return clone(f)
    },

    async createVersion(input, newClaims) {
      const dup = [...versions.values()].some(
        (v) => v.campaignId === input.campaignId && v.number === input.number,
      )
      if (dup)
        throw new Error('duplicate key value violates unique constraint (campaign_id, number)')
      const v: Version = { ...clone(input), id: randomUUID(), createdAt: input.createdAt ?? ts() }
      versions.set(v.id, v)
      const out = newClaims.map((c) => {
        const claim: Claim = { ...clone(c), id: c.id ?? randomUUID(), versionId: v.id }
        claims.set(claim.id, claim)
        return clone(claim)
      })
      return { version: clone(v), claims: out }
    },
    async getVersion(id) {
      const v = versions.get(id)
      return v ? clone(v) : null
    },
    async updateVersion(id, patch) {
      const v = must(versions, id, 'Version')
      const next = { ...v, ...clone(patch) }
      versions.set(id, next)
      return clone(next)
    },
    async deleteVersion(id) {
      versions.delete(id)
      for (const [cid, c] of claims) if (c.versionId === id) claims.delete(cid)
    },
    async listVersions(campaignId) {
      return [...versions.values()]
        .filter((v) => v.campaignId === campaignId)
        .sort((a, b) => a.number - b.number)
        .map(clone)
    },

    async listClaims(versionId) {
      return [...claims.values()].filter((c) => c.versionId === versionId).map(clone)
    },
    async listClaimsForVersions(ids) {
      const set = new Set(ids)
      return [...claims.values()].filter((c) => set.has(c.versionId)).map(clone)
    },
    async getClaim(id) {
      const c = claims.get(id)
      return c ? clone(c) : null
    },
    async updateClaim(id, patch) {
      const c = must(claims, id, 'Claim')
      const next = { ...c, ...clone(patch) }
      claims.set(id, next)
      return clone(next)
    },
    async replaceClaims(versionId, next) {
      for (const [id, c] of claims) if (c.versionId === versionId) claims.delete(id)
      return next.map((c) => {
        const claim: Claim = { ...clone(c), id: c.id ?? randomUUID(), versionId }
        claims.set(claim.id, claim)
        return clone(claim)
      })
    },

    async addEvents(list) {
      for (const e of list) {
        events.push({
          ...clone(e),
          props: clone(e.props ?? {}),
          utm: clone(e.utm ?? {}),
          id: ++eventSeq,
          createdAt: e.createdAt ?? ts(),
        })
      }
    },
    async listEvents(q) {
      const ids = q.campaignIds ? new Set(q.campaignIds) : null
      const out = events
        .filter((e) => {
          const byCampaign =
            (ids && e.campaignId && ids.has(e.campaignId)) || (q.withoutCampaign && !e.campaignId)
          if ((ids || q.withoutCampaign) && !byCampaign) return false
          if (q.pageKind && e.pageKind !== q.pageKind) return false
          if (q.since && Date.parse(e.createdAt) < q.since.getTime()) return false
          return true
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
      return (q.limit ? out.slice(-q.limit) : out).map(clone)
    },

    async createLead(input) {
      const l: Lead = { ...clone(input), id: randomUUID(), createdAt: input.createdAt ?? ts() }
      leads.set(l.id, l)
      return clone(l)
    },
    async getLead(id) {
      const l = leads.get(id)
      return l ? clone(l) : null
    },
    async updateLead(id, patch) {
      const l = must(leads, id, 'Lead')
      const next = { ...l, ...clone(patch) }
      leads.set(id, next)
      return clone(next)
    },
    async listLeads(ids, opts) {
      const set = new Set(ids)
      return [...leads.values()]
        .filter((l) => (l.campaignId ? set.has(l.campaignId) : Boolean(opts?.withoutCampaign)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone)
    },
    async findLeadByEmail(campaignId, email) {
      const l = [...leads.values()]
        .filter((x) => x.campaignId === campaignId && x.email.toLowerCase() === email.toLowerCase())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      return l ? clone(l) : null
    },

    async createMeeting(input) {
      const taken = [...meetings.values()].some(
        (m) =>
          m.campaignId === input.campaignId &&
          Date.parse(m.slotStart) === Date.parse(input.slotStart),
      )
      if (taken) return null
      const m: Meeting = { ...clone(input), id: randomUUID(), createdAt: input.createdAt ?? ts() }
      meetings.set(m.id, m)
      return clone(m)
    },
    async listMeetings(ids) {
      const set = new Set(ids)
      return [...meetings.values()]
        .filter((m) => m.campaignId && set.has(m.campaignId))
        .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
        .map(clone)
    },

    async audit(entry) {
      audit.push({
        id: ++auditSeq,
        createdAt: entry.createdAt ?? ts(),
        workspace: entry.workspace,
        campaignId: entry.campaignId,
        actorRole: entry.actorRole,
        action: entry.action,
        detail: clone(entry.detail ?? {}),
      })
    },
    async listAudit(campaignId) {
      return audit
        .filter((a) => a.campaignId === campaignId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
        .map((a) => {
          const { workspace, ...rest } = a
          void workspace
          return clone(rest)
        })
    },

    async hitRateLimit(key, limit) {
      const k = `${utcDay(now())}|${key}`
      const n = (limits.get(k) ?? 0) + 1
      limits.set(k, n)
      if (limits.size > 50_000) {
        const today = utcDay(now())
        for (const key2 of limits.keys()) if (!key2.startsWith(today)) limits.delete(key2)
      }
      return n <= limit
    },

    async purgeDemo(before) {
      const cutoff = before.getTime()
      let removed = 0
      for (const [id, c] of campaigns) {
        if (c.workspace !== 'demo' || Date.parse(c.createdAt) >= cutoff) continue
        campaigns.delete(id)
        removed++
        for (const [vid, v] of versions) {
          if (v.campaignId !== id) continue
          versions.delete(vid)
          for (const [cid, cl] of claims) if (cl.versionId === vid) claims.delete(cid)
        }
        for (let i = events.length - 1; i >= 0; i--)
          if (events[i]!.campaignId === id) events.splice(i, 1)
        for (const l of leads.values()) if (l.campaignId === id) l.campaignId = null
        for (const m of meetings.values()) if (m.campaignId === id) m.campaignId = null
      }
      for (const [id, a] of accounts) {
        if (a.workspace !== 'demo' || Date.parse(a.createdAt) >= cutoff) continue
        accounts.delete(id)
        for (const [sid, s] of sources) if (s.accountId === id) sources.delete(sid)
        for (const [fid, f] of facts) if (f.accountId === id) facts.delete(fid)
      }
      for (let i = audit.length - 1; i >= 0; i--) {
        const a = audit[i]!
        if (a.workspace === 'demo' && Date.parse(a.createdAt) < cutoff) audit.splice(i, 1)
      }
      return removed
    },
  }
}
