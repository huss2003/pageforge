import { formatClock, formatPercent } from '@/lib/factory/format'
import type { FactoryStats } from '@/lib/factory/stats'

/**
 * Median brief → live is the answer figure, set large. Everything else is a
 * quiet divided strip underneath, label over value.
 */
export function StatsPanel({ stats }: { stats: FactoryStats }) {
  const dash = <span className="text-fg-muted">–</span>
  const items = [
    {
      label: 'First-try QA pass',
      value:
        stats.firstTryPassRate != null ? (
          <>
            {formatPercent(stats.firstTryPassRate)}
            <span className="text-sm text-fg-muted"> of {stats.tested}</span>
          </>
        ) : (
          dash
        ),
    },
    {
      label: 'Fixes per run',
      value: stats.avgFixesPerRun != null ? stats.avgFixesPerRun.toFixed(1) : dash,
    },
    {
      label: 'Runs today',
      value: (
        <>
          {stats.today.runs}
          <span className="text-sm text-fg-muted"> of {stats.today.cap}</span>
        </>
      ),
    },
  ]

  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="text-sm font-semibold [font-stretch:100%]">
        Median brief to live
      </h2>
      <p className="mt-1 flex items-baseline gap-3">
        <span className="text-4xl font-semibold tabular-nums [font-stretch:125%]">
          {stats.medianTimeToShipMs != null ? formatClock(stats.medianTimeToShipMs) : '–'}
        </span>
        <span className="text-sm text-fg-muted">
          {stats.published
            ? `mm:ss across ${stats.published} published page${stats.published === 1 ? '' : 's'}, last ${stats.window} runs`
            : 'Publish a page to start the clock.'}
        </span>
      </p>

      <dl className="mt-5 grid grid-cols-3 border-y border-line">
        {items.map((i, n) => (
          <div key={i.label} className={`py-3 ${n ? 'border-l border-line pl-3 sm:pl-4' : ''}`}>
            <dt className="text-xs text-fg-muted">{i.label}</dt>
            <dd className="mt-0.5 text-lg tabular-nums">{i.value}</dd>
          </div>
        ))}
      </dl>

      {stats.modelMix.length > 0 && (
        <p className="mt-3 text-xs text-fg-muted">
          Model mix:{' '}
          {stats.modelMix.map((m, i) => (
            <span key={m.model} className="whitespace-nowrap">
              {i > 0 && ' · '}
              {m.model} <span className="tabular-nums">{m.runs}</span>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}
