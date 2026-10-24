import type { RunStatus } from '@/lib/factory/engine'
import { formatDuration, formatInt } from '@/lib/factory/format'
import { runningStatuses, stepLabels, statusLabels } from '@/lib/factory/labels'
import type { PublicRun, StoredStep } from '@/lib/factory/types'

/** Which step is in progress for a given status (shown as the pending row). */
const pendingStep: Partial<Record<RunStatus, string>> = {
  queued: 'Waiting for a worker',
  planning: 'Plan',
  writing: 'Write',
  validating: 'Validate',
  drafted: 'Save draft',
  'qa-running': 'QA',
  fixing: 'Fix',
}

export function Timeline({
  run,
  steps,
  now,
}: {
  run: PublicRun
  steps: StoredStep[]
  now: number
}) {
  const running = runningStatuses.includes(run.status)
  const totalTokens = steps.reduce(
    (n, s) => n + (s.tokens ? s.tokens.input + s.tokens.output : 0),
    0,
  )
  // Retries: a step name seen more than once with the same attempt number.
  const seen = new Map<string, number>()
  const lastStart = steps.at(-1)
  const pendingSince = lastStart
    ? new Date(lastStart.startedAt).getTime() + lastStart.durationMs
    : new Date(run.startedAt ?? run.createdAt).getTime()

  return (
    <section aria-labelledby="timeline-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="timeline-heading" className="text-sm font-semibold [font-stretch:100%]">
          Timeline
        </h2>
        {totalTokens > 0 && (
          <span className="text-xs text-fg-muted tabular-nums">
            {formatInt(totalTokens)} tokens
          </span>
        )}
      </div>
      <ol className="mt-2">
        {steps.map((s) => {
          const key = `${s.step}:${s.attempt}`
          const count = (seen.get(key) ?? 0) + 1
          seen.set(key, count)
          const label =
            s.step === 'qa' || s.step === 'fix'
              ? `${stepLabels[s.step]} · attempt ${s.attempt}`
              : stepLabels[s.step]
          return (
            <li
              key={s.id}
              className="relative grid grid-cols-[0.75rem_1fr] gap-x-2.5 pb-3 before:absolute before:top-3 before:bottom-0 before:left-[5px] before:w-px before:bg-line last:before:hidden"
            >
              <span
                aria-hidden="true"
                className={`relative mt-1.5 size-[11px] rounded-full border-2 ${
                  !s.ok
                    ? 'border-signal bg-surface'
                    : s.step === 'publish'
                      ? 'border-accent bg-accent'
                      : 'border-fg bg-fg'
                }`}
              />
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">
                    {label}
                    {count > 1 && (
                      <span className="font-normal text-fg-muted"> · retry {count - 1}</span>
                    )}
                    {!s.ok && <span className="sr-only"> (did not pass)</span>}
                  </span>
                  <span className="text-xs text-fg-muted tabular-nums">
                    {formatDuration(s.durationMs)}
                  </span>
                </div>
                <p className="text-fg-muted">{s.summary}</p>
                {s.error && <p className="mt-0.5 text-xs break-words">{s.error}</p>}
                {(s.model || s.tokens) && (
                  <p className="mt-0.5 text-xs text-fg-muted tabular-nums">
                    {s.model}
                    {s.model && s.tokens && ' · '}
                    {s.tokens &&
                      `${formatInt(s.tokens.input)} in / ${formatInt(s.tokens.output)} out`}
                  </p>
                )}
              </div>
            </li>
          )
        })}
        {running && (
          <li className="grid grid-cols-[0.75rem_1fr] gap-x-2.5">
            <span
              aria-hidden="true"
              className="relative mt-1.5 size-[11px] rounded-full border-2 border-accent bg-surface motion-safe:animate-pulse"
            />
            <div className="text-sm">
              <div className="flex items-baseline justify-between gap-x-3">
                <span className="font-semibold">
                  {pendingStep[run.status] ?? statusLabels[run.status]}
                </span>
                <span className="text-xs text-fg-muted tabular-nums" suppressHydrationWarning>
                  {formatDuration(Math.max(0, now - pendingSince))}
                </span>
              </div>
              <p className="text-fg-muted">{statusLabels[run.status]}…</p>
            </div>
          </li>
        )}
      </ol>
      {!running && steps.length === 0 && (
        <p className="mt-2 text-sm text-fg-muted">No steps were recorded for this run.</p>
      )}
    </section>
  )
}
