'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAudit, getEngagement, listLeads } from '@/lib/abm/client'
import type { AuditEntry, EngagementSummary, Lead } from '@/lib/abm/types'
import { CrmStatus } from '../crm-status'
import { formatDateTime, formatInt, formatRelative } from '../format'
import { eventLabels, roleLabels } from '../labels'
import { ErrorNote, Pill, Skeleton } from '../ui'
import type { WorkspaceApi } from './campaign-workspace'

type Tab = 'engagement' | 'leads' | 'audit'
type TimelineItem = EngagementSummary['timeline'][number]

function eventText(e: TimelineItem): string {
  const p = e.props as Record<string, unknown>
  if (e.type === 'scroll_depth') return `Scrolled to ${String(p.depth ?? '?')}%`
  if (e.type === 'meeting_booked' && typeof p.slot === 'string')
    return `Booked a meeting for ${formatDateTime(p.slot)}`
  if (e.type === 'cta_click' && typeof p.label === 'string') return `Clicked “${p.label}”`
  if (e.type === 'cta_click' && p.action === 'slot') return 'Picked a time in the calendar'
  if ((e.type === 'form_start' || e.type === 'form_submit') && p.form === 'meeting')
    return e.type === 'form_start' ? 'Started the booking form' : 'Sent the booking form'
  return eventLabels[e.type]
}

const actionLabels: Record<string, string> = {
  'brief.created': 'Wrote the brief',
  'sources.fetched': 'Read the website',
  'facts.updated': 'Changed which facts go to the writer',
  'draft.requested': 'Asked for a draft',
  'draft.generated': 'Draft written',
  'version.edited': 'Edited copy',
  'version.submitted': 'Submitted for review',
  'claim.supported': 'Marked a claim supported',
  'claim.rejected': 'Rejected a claim',
  'claim.needs_review': 'Sent a claim back to review',
  'version.approved': 'Approved the version',
  'version.changes_requested': 'Sent the version back',
  'cta.changed': 'Changed the call to action',
  'seo.changed': 'Changed search settings',
  'campaign.published': 'Published',
  'campaign.paused': 'Paused the page',
  'campaign.resumed': 'Resumed the page',
  'campaign.rolled_back': 'Rolled back',
  'campaign.duplicated': 'Duplicated from another page',
  'lead.created': 'New lead',
  'meeting.booked': 'Meeting booked',
}

function auditDetail(a: AuditEntry): string | null {
  const d = a.detail as Record<string, unknown>
  const parts: string[] = []
  if (typeof d.version === 'number') parts.push(`version ${d.version}`)
  if (typeof d.claim === 'string') parts.push(`“${d.claim}”`)
  if (typeof d.note === 'string' && d.note) parts.push(`note: ${d.note}`)
  if (typeof d.claims === 'number') parts.push(`${d.claims} claims`)
  if (typeof d.pages === 'number') parts.push(`${d.pages} pages`)
  if (typeof d.company === 'string') parts.push(d.company)
  if (typeof d.label === 'string') parts.push(`“${d.label}”`)
  if (typeof d.model === 'string')
    parts.push(d.model === 'simulation' ? 'simulated writer' : d.model)
  return parts.length ? parts.join(', ') : null
}

function shortVisitor(id: string) {
  return id.replace(/^v/, '').slice(0, 6)
}

export function EngagementStep({ api }: { api: WorkspaceApi }) {
  const { campaign: c } = api
  const [tab, setTab] = useState<Tab>('engagement')
  const [eng, setEng] = useState<EngagementSummary | null>(null)
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [e, l, a] = await Promise.all([getEngagement(c.id), listLeads(), getAudit(c.id)])
      setEng(e)
      setLeads(l.filter((x) => x.campaignId === c.id))
      setAudit(a)
      setNow(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load engagement.')
    }
  }, [c.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const visitors = useMemo(() => {
    if (!eng) return []
    const by = new Map<string, TimelineItem[]>()
    for (const e of eng.timeline) {
      const list = by.get(e.visitorId) ?? []
      list.push(e)
      by.set(e.visitorId, list)
    }
    return [...by.entries()].map(([id, events]) => {
      const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at))
      return {
        id,
        events: sorted,
        visits: events.filter((e) => e.type === 'page_view').length,
        maxScroll: Math.max(
          0,
          ...events
            .filter((e) => e.type === 'scroll_depth')
            .map((e) => Number((e.props as { depth?: number }).depth) || 0),
        ),
        last: sorted[0]?.at ?? null,
        lead: leads?.find((l) => l.visitorId === id) ?? null,
      }
    })
  }, [eng, leads])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'engagement', label: 'Engagement' },
    { id: 'leads', label: 'Leads', count: leads?.length },
    { id: 'audit', label: 'Audit log', count: audit?.length },
  ]

  const hotReasons = eng
    ? [
        visitors.some(
          (v) =>
            v.events.filter(
              (e) => e.type === 'page_view' && now - new Date(e.at).getTime() < 7 * 864e5,
            ).length >= 2,
        ) && 'a visitor came back',
        eng.maxScroll >= 75 && `read to ${eng.maxScroll}%`,
        eng.ctaClicks > 0 && 'clicked the call to action',
      ].filter(Boolean)
    : []

  const totals = eng
    ? [
        ['Visitors', formatInt(eng.visitors)],
        ['Views', formatInt(eng.views)],
        ['Deepest scroll', `${eng.maxScroll}%`],
        ['CTA clicks', formatInt(eng.ctaClicks)],
        ['Form starts', formatInt(eng.formStarts)],
        ['Form submits', formatInt(eng.formSubmits)],
        ['Meetings', formatInt(eng.meetings)],
        ['Last active', eng.lastActiveAt ? formatRelative(eng.lastActiveAt, now) : '–'],
      ]
    : null

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Engagement views" className="flex gap-1 text-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 rounded-control border border-transparent px-2.5 py-1.5 text-fg-muted hover:text-fg aria-selected:border-line aria-selected:bg-surface-raised aria-selected:text-fg"
          >
            {t.label}
            {t.count !== undefined && (
              <span className="text-xs tabular-nums text-fg-muted">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {error && <ErrorNote onRetry={load}>{error}</ErrorNote>}

      {tab === 'engagement' && (
        <div
          role="tabpanel"
          id="panel-engagement"
          aria-labelledby="tab-engagement"
          className="space-y-6"
        >
          <section aria-labelledby="totals-heading">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="totals-heading" className="text-sm font-semibold [font-stretch:100%]">
                All visitors
              </h2>
              {eng?.hot && (
                <span className="flex items-center gap-2 text-sm">
                  <Pill tone="accent">Hot</Pill>
                  <span className="text-fg-muted">in the last 7 days: {hotReasons.join(', ')}</span>
                </span>
              )}
              {eng && !eng.hot && (
                <span className="text-sm text-fg-muted">
                  Not hot: no return visit, deep read or CTA click in 7 days.
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
              {(totals ?? Array.from({ length: 8 }, (_, i) => [String(i), ''])).map(
                ([label, value]) => (
                  <div key={label} className="bg-surface px-3 py-2.5">
                    {totals ? (
                      <>
                        <dt className="text-xs text-fg-muted">{label}</dt>
                        <dd className="mt-0.5 text-xl tabular-nums">{value}</dd>
                      </>
                    ) : (
                      <>
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="mt-2 h-6 w-10" />
                      </>
                    )}
                  </div>
                ),
              )}
            </dl>
          </section>

          <section aria-labelledby="visitors-heading">
            <h2 id="visitors-heading" className="text-sm font-semibold [font-stretch:100%]">
              Visitors
            </h2>
            {eng && visitors.length === 0 && (
              <p className="mt-2 border-y border-dashed border-line py-4 text-sm text-fg-muted">
                {c.publishedVersionId
                  ? 'No visits yet. Send a tracked link from the Publish step; each visit shows up here.'
                  : 'Publish the page to start recording visits.'}
              </p>
            )}
            <div className="mt-2 grid items-start gap-4 xl:grid-cols-2">
              {visitors.map((v) => (
                <article
                  key={v.id}
                  className="rounded-control border border-line bg-surface-raised"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-3.5 py-2">
                    <h3 className="text-sm font-semibold [font-stretch:100%]">
                      {v.lead
                        ? `${v.lead.name}, ${v.lead.company}`
                        : `Anonymous visitor ${shortVisitor(v.id)}`}
                    </h3>
                    <p className="text-xs text-fg-muted tabular-nums">
                      {v.visits} {v.visits === 1 ? 'visit' : 'visits'}, read to {v.maxScroll}%, last
                      seen {v.last ? formatRelative(v.last, now) : '–'}
                    </p>
                  </header>
                  <ol className="px-3.5 py-2">
                    {v.events.map((e, i) => (
                      <li
                        key={`${e.at}-${i}`}
                        className="relative grid grid-cols-[0.75rem_1fr_auto] gap-x-2.5 py-1 text-sm before:absolute before:top-4 before:bottom-[-0.25rem] before:left-[5px] before:w-px before:bg-line last:before:hidden"
                      >
                        <span
                          aria-hidden="true"
                          className={`relative mt-1.5 size-[11px] rounded-full border-2 ${
                            e.type === 'meeting_booked' || e.type === 'form_submit'
                              ? 'border-accent bg-accent'
                              : e.type === 'cta_click'
                                ? 'border-accent bg-surface'
                                : 'border-fg-muted bg-surface'
                          }`}
                        />
                        <span>{eventText(e)}</span>
                        <time dateTime={e.at} className="text-xs text-fg-muted tabular-nums">
                          {formatDateTime(e.at)}
                        </time>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
            <p className="mt-2 text-xs text-fg-muted">
              Visitors are anonymous until they fill in a form. Ids live in the visitor&rsquo;s own
              browser storage; no cookies.
            </p>
          </section>
        </div>
      )}

      {tab === 'leads' && (
        <div role="tabpanel" id="panel-leads" aria-labelledby="tab-leads">
          {leads && leads.length === 0 && (
            <p className="border-y border-dashed border-line py-4 text-sm text-fg-muted">
              No one from this page has filled in a form yet.
            </p>
          )}
          {leads && leads.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-fg-muted">
                  <th scope="col" className="py-2 pr-3 font-normal">
                    Contact
                  </th>
                  <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">
                    Source
                  </th>
                  <th scope="col" className="py-2 pr-3 font-normal">
                    CRM
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-line align-baseline">
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold">{l.name}</span>
                      <span className="block text-xs text-fg-muted">
                        {l.role ? `${l.role}, ` : ''}
                        {l.email}
                      </span>
                    </td>
                    <td className="hidden py-2.5 pr-3 sm:table-cell">
                      {l.utm.source ?? <span className="text-fg-muted">Direct</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <CrmStatus lead={l} />
                    </td>
                    <td className="py-2.5 text-right text-fg-muted tabular-nums">
                      {formatDateTime(l.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div role="tabpanel" id="panel-audit" aria-labelledby="tab-audit">
          <ol className="border-t border-line">
            {(audit ?? []).map((a) => {
              const detail = auditDetail(a)
              return (
                <li
                  key={a.id}
                  className="grid gap-x-4 border-b border-line py-2 text-sm sm:grid-cols-[9rem_7rem_1fr]"
                >
                  <time dateTime={a.createdAt} className="text-fg-muted tabular-nums">
                    {formatDateTime(a.createdAt)}
                  </time>
                  <span className="text-fg-muted">
                    {a.actorRole === 'system' ? 'System' : (roleLabels[a.actorRole] ?? a.actorRole)}
                  </span>
                  <span>
                    {actionLabels[a.action] ?? a.action}
                    {detail && <span className="text-fg-muted">: {detail}</span>}
                  </span>
                </li>
              )
            })}
          </ol>
          {audit && audit.length === 0 && (
            <p className="py-4 text-sm text-fg-muted">Nothing recorded yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
