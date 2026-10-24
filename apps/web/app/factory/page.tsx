import type { Metadata } from 'next'
import Link from 'next/link'
import { getConfig } from '@/lib/factory/config'
import { isAdmin, quotaForRequest } from '@/lib/factory/session'
import { computeStats } from '@/lib/factory/stats'
import { getRuntime, getStore } from '@/lib/factory/store'
import { BriefForm } from './_components/brief-form'
import { RunTable } from './_components/run-table'
import { StatsPanel } from './_components/stats-panel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'PageForge Factory: brief to live page' },
}

const steps = [
  ['Plan', 'The planner picks blocks from the Hoverline design system for this prospect.'],
  ['Write', 'The writer fills each block using only approved brand facts.'],
  ['Test', 'Lighthouse and axe score the draft on mobile against fixed thresholds.'],
  ['Fix', 'The fixer patches the copy behind each issue, then QA runs again.'],
  ['Publish', 'You approve; the page goes live and the clock stops.'],
] as const

export default async function FactoryPage() {
  const [admin, quota, stats, runs] = await Promise.all([
    isAdmin(),
    quotaForRequest(),
    computeStats(),
    getStore().listRecentRuns(6),
  ])
  const config = getConfig()
  const now = getRuntime().now().getTime()

  return (
    <main className="mx-auto grid max-w-[90rem] grid-cols-1 gap-x-12 gap-y-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:py-10">
      <div className="min-w-0">
        <h1 className="text-xl">Build a landing page from a brief</h1>
        <p className="mt-2 max-w-measure text-fg-muted">
          Describe the prospect. AI agents plan and write a Hoverline page, QA tests it, a fixer
          resolves what fails, and you publish it.
        </p>
        <div className="mt-8 rounded-media border border-line bg-surface-raised/50 p-4 sm:p-6">
          <BriefForm
            turnstileSiteKey={config.turnstile.siteKey}
            canProduction={admin && config.sanity !== null}
            remaining={admin ? Number.POSITIVE_INFINITY : quota.remaining}
          />
        </div>
      </div>

      <div className="min-w-0 space-y-10 lg:pt-1">
        <StatsPanel stats={stats} />

        <section aria-labelledby="recent-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-heading" className="text-sm font-semibold [font-stretch:100%]">
              Recent runs
            </h2>
            {runs.length > 0 && (
              <Link href="/factory/runs" className="text-sm underline underline-offset-4">
                View all runs
              </Link>
            )}
          </div>
          {runs.length ? (
            <div className="mt-2">
              <RunTable runs={runs.slice(0, 5)} compact now={now} />
            </div>
          ) : (
            <p className="mt-3 border-y border-dashed border-line py-6 text-sm text-fg-muted">
              No runs yet. Build your first page with the brief form.
            </p>
          )}
        </section>

        <section aria-labelledby="pipeline-heading">
          <h2 id="pipeline-heading" className="text-sm font-semibold [font-stretch:100%]">
            What happens after you submit
          </h2>
          <ol className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {steps.map(([name, detail]) => (
              <li key={name} className="border-l-2 border-contour pl-3">
                <span className="font-semibold">{name}</span>
                <span className="block text-fg-muted">{detail}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  )
}
