import { defaultThresholds, type QaIssue, type QaThresholds } from '@pageforge/qa'
import { blockTitles, scoreLabels } from '@/lib/factory/labels'
import type { FixRecord, PublicRun, QaRecord } from '@/lib/factory/types'

const order = Object.keys(scoreLabels) as (keyof QaThresholds)[]

function blockLabel(run: PublicRun, key: string | null | undefined) {
  if (!key) return 'Page'
  const b = run.page?.blocks.find((x) => x._key === key)
  return b ? (blockTitles[b._type] ?? b._type) : key
}

/** Scores as a bar against the threshold tick; amber only where a score misses. */
function ScoreRow({ name, value, min }: { name: string; value: number; min: number }) {
  const ok = value >= min
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.25rem] items-center gap-x-3 py-1.5 text-sm">
      <dt className="truncate">{name}</dt>
      <dd className="relative h-1.5 rounded-full bg-line" aria-hidden="true">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${ok ? 'bg-fg' : 'bg-signal'}`}
          style={{ width: `${value}%` }}
        />
        <span className="absolute -top-1 -bottom-1 w-px bg-fg-muted" style={{ left: `${min}%` }} />
      </dd>
      <dd className="text-right font-semibold tabular-nums">
        {value}
        <span className="sr-only">
          {' '}
          out of 100, threshold {min}, {ok ? 'meets it' : 'below it'}
        </span>
      </dd>
    </div>
  )
}

function IssueGroups({ run, issues }: { run: PublicRun; issues: QaIssue[] }) {
  const groups = new Map<string, QaIssue[]>()
  for (const i of issues) {
    const k = i.blockKey ?? ''
    groups.set(k, [...(groups.get(k) ?? []), i])
  }
  return (
    <ul className="mt-2 space-y-3">
      {[...groups.entries()].map(([key, list]) => (
        <li key={key || 'page'} className="text-sm">
          <p className="font-semibold">
            {blockLabel(run, key)}
            {key && <span className="ml-1.5 text-xs font-normal text-fg-muted">{key}</span>}
          </p>
          <ul className="mt-1 space-y-1">
            {list.map((i, n) => (
              <li key={`${i.id}-${n}`} className="border-l-2 border-signal pl-2.5">
                <span className="text-xs text-fg-muted">
                  {i.source} · {i.id}
                </span>
                <span className="block">{i.message}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function FixList({ run, fix }: { run: PublicRun; fix: FixRecord }) {
  if (fix.changes.length === 0) {
    return <p className="mt-1 text-sm text-fg-muted">The fixer made no content changes.</p>
  }
  return (
    <ul className="mt-2 space-y-3">
      {fix.changes.map((c, i) => (
        <li key={i} className="text-sm">
          <p className="text-xs text-fg-muted">
            {blockLabel(run, c.blockKey)} · {c.field}
          </p>
          <p className="mt-1">
            <del className="text-fg-muted decoration-fg-muted/60">{c.before || '(empty)'}</del>
          </p>
          <p>
            <ins className="no-underline">{c.after || '(empty)'}</ins>
          </p>
        </li>
      ))}
    </ul>
  )
}

export function QaPanel({
  run,
  qa,
  qaMode,
}: {
  run: PublicRun
  qa: QaRecord[]
  qaMode: 'live' | 'simulated'
}) {
  const latest = qa.at(-1)
  const simulated = latest ? latest.simulated : qaMode === 'simulated'

  return (
    <section aria-labelledby="qa-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="qa-heading" className="text-sm font-semibold [font-stretch:100%]">
          {simulated ? 'Simulated QA' : 'QA'}
        </h2>
        <span className="text-xs text-fg-muted">
          {simulated
            ? 'Scored from the page content; Lighthouse runs when GitHub Actions is connected.'
            : 'Mobile Lighthouse and axe in GitHub Actions'}
        </span>
      </div>

      {!latest ? (
        <div className="mt-2 border-y border-dashed border-line py-4 text-sm text-fg-muted">
          <p>
            Thresholds: performance {defaultThresholds.performance}, accessibility{' '}
            {defaultThresholds.accessibility}, SEO {defaultThresholds.seo}, best practices{' '}
            {defaultThresholds.bestPractices}.
          </p>
          <p className="mt-1">
            {run.status === 'failed'
              ? 'QA did not run.'
              : 'Scores appear when the draft has been tested.'}
          </p>
        </div>
      ) : (
        <ol className="mt-1 divide-y divide-line">
          {[...qa].reverse().map((r) => {
            const fix = run.fixes.find((f) => f.attempt === r.attempt)
            const isLatest = r === latest
            return (
              <li key={r.attempt} className="py-3">
                <details open={isLatest || Boolean(fix)} className="group">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 text-sm [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold">
                      Attempt {r.attempt}
                      <span className="ml-2 font-normal text-fg-muted">
                        {r.passed
                          ? 'Meets every threshold'
                          : `${r.issues.length} issue${r.issues.length === 1 ? '' : 's'}`}
                      </span>
                    </span>
                    <span className="text-xs text-fg-muted group-open:hidden">Show</span>
                  </summary>

                  <dl className="mt-2">
                    {order.map((k) => (
                      <ScoreRow
                        key={k}
                        name={scoreLabels[k]}
                        value={r.scores[k]}
                        min={defaultThresholds[k]}
                      />
                    ))}
                  </dl>
                  <p className="mt-1 text-xs text-fg-muted">
                    The tick on each bar marks the threshold.
                    {r.workflowRunUrl && (
                      <>
                        {' '}
                        <a
                          href={r.workflowRunUrl}
                          className="underline underline-offset-4"
                          rel="noopener"
                        >
                          Workflow run
                        </a>
                      </>
                    )}
                  </p>

                  {r.issues.length > 0 && <IssueGroups run={run} issues={r.issues} />}

                  {fix && (
                    <div className="mt-4 border-t border-dashed border-line pt-3">
                      <p className="text-sm font-semibold">
                        Fixer changes after attempt {r.attempt}
                      </p>
                      <FixList run={run} fix={fix} />
                    </div>
                  )}
                </details>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
