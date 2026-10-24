'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCampaigns, type CampaignRow } from '@/lib/abm/client'
import type { CampaignStatus } from '@/lib/abm/types'
import { useDeskSession } from './desk-shell'
import { formatRelative } from './format'
import { industryLabels, typeShort } from './labels'
import { CampaignStatus as StatusLabel } from './marks'
import { livePath } from './paths'
import { buttonClass, ErrorNote, Pill, Skeleton } from './ui'

type Filter = 'all' | 'draft' | 'review' | 'live' | 'stopped'

const filters: { id: Filter; label: string; match: (s: CampaignStatus) => boolean }[] = [
  { id: 'all', label: 'All', match: (s) => s !== 'archived' },
  { id: 'review', label: 'In review', match: (s) => s === 'in_review' || s === 'approved' },
  { id: 'draft', label: 'Drafts', match: (s) => s === 'draft' || s === 'generating' },
  { id: 'live', label: 'Live', match: (s) => s === 'published' },
  { id: 'stopped', label: 'Paused or expired', match: (s) => s === 'paused' || s === 'expired' },
]

export function CampaignList() {
  const { can, session } = useDeskSession()
  const [rows, setRows] = useState<CampaignRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await listCampaigns())
      setNow(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load account pages.')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>
    for (const f of filters) out[f.id] = rows?.filter((r) => f.match(r.status)).length ?? 0
    return out
  }, [rows])

  const match = filters.find((f) => f.id === filter)!.match
  const visible = rows?.filter((r) => match(r.status)) ?? []
  const toReview = rows?.reduce((n, r) => n + r.claimsNeedingReview, 0) ?? 0
  const canCreate = can('marketer', 'sales')

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-xl">Account pages</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {rows === null
              ? 'Loading…'
              : session.role === 'reviewer'
                ? toReview
                  ? `${toReview} ${toReview === 1 ? 'claim is' : 'claims are'} waiting for your review.`
                  : 'Nothing is waiting for review.'
                : `${rows.length} ${rows.length === 1 ? 'page' : 'pages'} in this workspace.`}
          </p>
        </div>
        {canCreate && (
          <Link href="/abm/new" className={buttonClass('primary')}>
            New account page
          </Link>
        )}
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        className="mt-6 -mx-4 flex gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:px-0"
      >
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className="flex items-center gap-1.5 rounded-control border border-transparent px-2.5 py-1.5 whitespace-nowrap text-fg-muted hover:text-fg aria-pressed:border-line aria-pressed:bg-surface-raised aria-pressed:text-fg"
          >
            {f.label}
            <span className="text-xs tabular-nums text-fg-muted">{rows ? counts[f.id] : ''}</span>
          </button>
        ))}
      </div>

      {error && (
        <ErrorNote className="mt-4" onRetry={load}>
          {error}
        </ErrorNote>
      )}

      {rows === null && !error && (
        <div className="mt-3 space-y-0 border-t border-line" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-6 border-b border-line py-3.5">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="mt-3 border-y border-dashed border-line py-8">
          <p className="font-semibold">No account pages yet.</p>
          <p className="mt-1 max-w-[60ch] text-sm text-fg-muted">
            Start with a brief: the company, its website and what keeps the target reader up at
            night. Hoverline reads the public site for facts, drafts a page from approved product
            facts and hands every claim to a reviewer.
          </p>
          {canCreate ? (
            <Link href="/abm/new" className={`${buttonClass('primary')} mt-4`}>
              Write the first brief
            </Link>
          ) : (
            <p className="mt-3 text-sm">
              Switch to Marketer in the header to write the first brief.
            </p>
          )}
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <table className="mt-3 hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="text-left text-xs text-fg-muted">
                <th scope="col" className="py-2 pr-4 font-normal">
                  Account
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Type
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Status
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">
                  Claims to review
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Published URL
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-normal">
                  Last activity
                </th>
                <th scope="col" className="py-2 font-normal">
                  <span className="sr-only">Engagement</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const path = livePath(r)
                return (
                  <tr
                    key={r.id}
                    className="border-t border-line align-baseline hover:bg-surface-raised/60"
                  >
                    <td className="max-w-0 py-3 pr-4 lg:w-[30%]">
                      <Link
                        href={`/abm/campaigns/${r.id}`}
                        className="block truncate font-semibold underline-offset-4 hover:underline"
                      >
                        {r.accountName ?? `${industryLabels[r.industry]} solutions`}
                      </Link>
                      <span className="text-xs text-fg-muted">{industryLabels[r.industry]}</span>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{typeShort[r.type]}</td>
                    <td className="py-3 pr-4">
                      <StatusLabel status={r.status} />
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {r.claimsNeedingReview > 0 ? (
                        <span className="font-semibold">{r.claimsNeedingReview}</span>
                      ) : (
                        <span className="text-fg-muted">0</span>
                      )}
                    </td>
                    <td className="max-w-0 py-3 pr-4 lg:w-[26%]">
                      {path ? (
                        <a
                          href={path}
                          target="_blank"
                          rel="noopener"
                          className={`block truncate underline-offset-4 hover:underline ${r.status === 'paused' ? 'text-fg-muted line-through' : ''}`}
                          title={path}
                        >
                          {path}
                        </a>
                      ) : (
                        <span className="text-fg-muted">–</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap text-fg-muted tabular-nums">
                      <time dateTime={r.updatedAt}>
                        {now ? formatRelative(r.updatedAt, now) : ''}
                      </time>
                    </td>
                    <td className="py-3 text-right">{r.hot && <Pill tone="accent">Hot</Pill>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <ul className="mt-3 border-t border-line md:hidden">
            {visible.map((r) => {
              const path = livePath(r)
              return (
                <li key={r.id} className="border-b border-line py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/abm/campaigns/${r.id}`}
                      className="min-w-0 truncate font-semibold"
                    >
                      {r.accountName ?? `${industryLabels[r.industry]} solutions`}
                    </Link>
                    {r.hot && <Pill tone="accent">Hot</Pill>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-fg-muted">
                    <span className="text-fg">
                      <StatusLabel status={r.status} />
                    </span>
                    <span>{typeShort[r.type]}</span>
                    {r.claimsNeedingReview > 0 && (
                      <span className="text-fg tabular-nums">
                        {r.claimsNeedingReview} to review
                      </span>
                    )}
                    <span className="tabular-nums">
                      {now ? formatRelative(r.updatedAt, now) : ''}
                    </span>
                  </div>
                  {path && <p className="mt-0.5 truncate text-xs text-fg-muted">{path}</p>}
                </li>
              )
            })}
          </ul>

          {visible.length === 0 && (
            <p className="border-b border-dashed border-line py-6 text-sm text-fg-muted">
              No pages match this filter.
            </p>
          )}
        </>
      )}
    </main>
  )
}
