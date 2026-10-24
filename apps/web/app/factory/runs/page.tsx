import type { Metadata } from 'next'
import Link from 'next/link'
import { computeStats } from '@/lib/factory/stats'
import { getRuntime, getStore } from '@/lib/factory/store'
import { RunTable } from '../_components/run-table'
import { StatsPanel } from '../_components/stats-panel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Runs' }

export default async function RunsPage() {
  const [stats, runs] = await Promise.all([computeStats(), getStore().listRecentRuns(50)])
  return (
    <main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl">Runs</h1>
        <Link
          href="/factory"
          className="rounded-control bg-fg px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
        >
          New brief
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <StatsPanel stats={stats} />
        <section aria-labelledby="history-heading" className="min-w-0">
          <h2 id="history-heading" className="text-sm font-semibold [font-stretch:100%]">
            Last {stats.window} runs
          </h2>
          {runs.length ? (
            <div className="mt-2">
              <RunTable runs={runs} now={getRuntime().now().getTime()} />
            </div>
          ) : (
            <p className="mt-3 border-y border-dashed border-line py-6 text-sm text-fg-muted">
              No runs yet.{' '}
              <Link href="/factory" className="text-fg underline underline-offset-4">
                Build your first page
              </Link>{' '}
              from a brief.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
