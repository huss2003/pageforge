'use client'

import { useCallback, useEffect, useState } from 'react'
import { getOverview, type Overview } from '@/lib/abm/client'
import type { ConversionComparison } from '@/lib/abm/types'
import { formatInt, formatMinutes, formatRate } from './format'
import { ErrorNote, Pill, Skeleton } from './ui'

const MIN_SAMPLE = 100
const TARGET_MS = 15 * 60_000

/** A round axis maximum just above the largest value, in rate units. */
export function axisMax(values: number[]): number {
  const max = Math.max(0.01, ...values)
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1]
  return steps.find((s) => s >= max) ?? 1
}

function RateBars({
  title,
  account,
  generic,
}: {
  title: string
  account: number
  generic: number
}) {
  const max = axisMax([account, generic])
  const ticks = [0, max / 2, max]
  const rows = [
    { label: 'Account pages', value: account, cls: 'bg-accent' },
    {
      label: 'Generic /solutions',
      value: generic,
      cls: 'bg-[color-mix(in_oklab,var(--fg-muted)_55%,var(--surface))]',
    },
  ]
  return (
    <figure>
      <figcaption className="text-sm font-semibold [font-stretch:100%]">{title}</figcaption>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-x-3 text-sm sm:grid-cols-[10rem_1fr_3.5rem]"
          >
            <span className="text-fg-muted">{r.label}</span>
            <span className="relative h-5 border-l border-fg-muted/60">
              <span
                className={`absolute inset-y-0 left-0 ${r.cls}`}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{formatRate(r.value)}</span>
          </div>
        ))}
        <div
          className="grid grid-cols-[8.5rem_1fr_3.5rem] gap-x-3 text-xs text-fg-muted sm:grid-cols-[10rem_1fr_3.5rem]"
          aria-hidden="true"
        >
          <span />
          <span className="relative h-4">
            {ticks.map((t, i) => (
              <span
                key={t}
                className="absolute tabular-nums"
                style={{
                  left: `${(t / max) * 100}%`,
                  transform:
                    i === 0
                      ? 'none'
                      : i === ticks.length - 1
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                }}
              >
                {`${Number((t * 100).toFixed(1))}%`}
              </span>
            ))}
          </span>
          <span />
        </div>
      </div>
    </figure>
  )
}

function Verdict({ c }: { c: ConversionComparison }) {
  const small =
    c.insufficientSample || c.account.visitors < MIN_SAMPLE || c.generic.visitors < MIN_SAMPLE
  if (small) {
    const short = c.account.visitors < MIN_SAMPLE ? 'account pages have' : 'generic pages have'
    const n = Math.min(c.account.visitors, c.generic.visitors)
    return (
      <p className="text-sm">
        <span className="font-semibold">Not enough data to call a winner.</span>{' '}
        <span className="text-fg-muted">
          Each side needs at least {MIN_SAMPLE} visitors; {short} {formatInt(n)}. The rates below
          are a direction, not a result.
        </span>
      </p>
    )
  }
  const better = c.account.formRate > c.generic.formRate
  return (
    <p className="text-sm">
      <span className="font-semibold">
        {better
          ? 'Account pages convert more visitors into leads.'
          : 'Account pages are not converting better yet.'}
      </span>{' '}
      <span className="text-fg-muted">
        Form rate {formatRate(c.account.formRate)} against {formatRate(c.generic.formRate)}, with at
        least {MIN_SAMPLE} visitors on each side.
      </span>
    </p>
  )
}

export function OverviewView() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setData(await getOverview())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the overview.')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const c = data?.comparison
  const r = data?.review

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl">Overview</h1>
        {c?.illustrative && <Pill tone="warn">Illustrative data</Pill>}
      </div>
      <p className="mt-1 max-w-[70ch] text-sm text-fg-muted">
        Do pages written for one account convert better than the generic industry pages, and is
        review keeping up?
      </p>
      {error && (
        <ErrorNote className="mt-4" onRetry={load}>
          {error}
        </ErrorNote>
      )}

      <div className="mt-6 grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="cmp-heading" className="min-w-0">
          <h2 id="cmp-heading" className="text-lg [font-stretch:100%]">
            Account pages against /solutions
          </h2>
          {!c ? (
            <div className="mt-4 space-y-3" aria-busy="true">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="mt-2">
                <Verdict c={c} />
              </div>
              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-fg-muted">
                    <th scope="col" className="py-1.5 pr-3 font-normal">
                      Pages
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">
                      Visitors
                    </th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-normal">
                      Form submits
                    </th>
                    <th scope="col" className="py-1.5 text-right font-normal">
                      Meetings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Account pages', c.account],
                    ['Generic /solutions', c.generic],
                  ].map(([label, s]) => {
                    const side = s as ConversionComparison['account']
                    return (
                      <tr key={label as string} className="border-t border-line">
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          {label as string}
                        </th>
                        <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                          {formatInt(side.visitors)}
                          {side.visitors < MIN_SAMPLE && (
                            <span className="ml-1 hidden text-xs text-fg-muted sm:inline">
                              (under {MIN_SAMPLE})
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                          {formatRate(side.formRate)}{' '}
                          <span className="text-xs text-fg-muted">
                            ({formatInt(Math.round(side.formRate * side.visitors))})
                          </span>
                        </td>
                        <td className="py-2 text-right whitespace-nowrap tabular-nums">
                          {formatRate(side.meetingRate)}{' '}
                          <span className="text-xs text-fg-muted">
                            ({formatInt(Math.round(side.meetingRate * side.visitors))})
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
                <RateBars
                  title="Form-submit rate"
                  account={c.account.formRate}
                  generic={c.generic.formRate}
                />
                <RateBars
                  title="Meeting rate"
                  account={c.account.meetingRate}
                  generic={c.generic.meetingRate}
                />
              </div>
              <p className="mt-4 text-xs text-fg-muted">
                Rate is the share of unique visitors who did it at least once. Visitors are counted
                by an anonymous first-party id, so one person on two devices counts twice.
                {c.illustrative && ' These figures are sample data, not results.'}
              </p>
            </>
          )}
        </section>

        <section aria-labelledby="review-heading" className="min-w-0">
          <h2 id="review-heading" className="text-lg [font-stretch:100%]">
            Review
          </h2>
          {!r ? (
            <div className="mt-4 space-y-3" aria-busy="true">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              <dl className="mt-3 divide-y divide-line border-y border-line">
                {[
                  {
                    label: 'Brief to review-ready, median',
                    value:
                      r.medianBriefToReviewMs != null
                        ? formatMinutes(r.medianBriefToReviewMs)
                        : '–',
                    note:
                      r.medianBriefToReviewMs == null
                        ? 'No drafts yet.'
                        : r.medianBriefToReviewMs <= TARGET_MS
                          ? `Within the 15-minute target, ${formatMinutes(TARGET_MS - r.medianBriefToReviewMs)} to spare.`
                          : `Over the 15-minute target by ${formatMinutes(r.medianBriefToReviewMs - TARGET_MS)}.`,
                    warn: r.medianBriefToReviewMs != null && r.medianBriefToReviewMs > TARGET_MS,
                  },
                  {
                    label: 'Brief to live, median',
                    value:
                      r.medianBriefToPublishMs != null
                        ? formatMinutes(r.medianBriefToPublishMs)
                        : '–',
                    note: 'Includes the time a page waits for a reviewer.',
                  },
                  {
                    label: 'Claims per page',
                    value: r.avgClaims.toFixed(1),
                    note: 'Every factual statement the writer made, across versions.',
                  },
                  {
                    label: 'Claims with a source',
                    value: `${r.pctSourced.toFixed(0)}%`,
                    note: 'Positioning counts as sourced: it is labelled and may not contain numbers.',
                  },
                  {
                    label: 'Claims rejected',
                    value: `${r.pctRejected.toFixed(0)}%`,
                    note: 'Rejected claims never reach a published page.',
                  },
                ].map((m) => (
                  <div key={m.label} className="grid grid-cols-[1fr_auto] gap-x-4 py-3">
                    <dt className="text-sm">{m.label}</dt>
                    <dd className="row-span-2 self-center text-right text-xl tabular-nums">
                      {m.value}
                    </dd>
                    <dd className={`text-xs ${m.warn ? 'text-fg' : 'text-fg-muted'}`}>
                      {m.warn && (
                        <span
                          aria-hidden="true"
                          className="mr-1.5 inline-block size-1.5 rounded-full bg-signal align-middle"
                        />
                      )}
                      {m.note}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
