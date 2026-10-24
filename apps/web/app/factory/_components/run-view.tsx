'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { goalLabels, siteTypeLabels } from '@/lib/factory/brief-data'
import { formatClock } from '@/lib/factory/format'
import { runningStatuses, statusLabels } from '@/lib/factory/labels'
import type { RunPayload } from '@/lib/factory/types'
import { PlanList } from './plan-list'
import { PreviewFrame } from './preview-frame'
import { QaPanel } from './qa-panel'
import { StatusMark } from './status-mark'
import { Timeline } from './timeline'

const POLL_MS = 1500

function headline(p: RunPayload): string {
  const { run, qa } = p
  const last = qa.at(-1)
  switch (run.status) {
    case 'published':
      return `Live. ${run.fixes.length ? `The fixer resolved QA issues in ${run.fixes.length} pass${run.fixes.length === 1 ? '' : 'es'} before publishing.` : 'QA passed on the first try.'}`
    case 'ready':
      if (last && !last.passed)
        return `QA still reports ${last.issues.length} issue${last.issues.length === 1 ? '' : 's'} after ${qa.length} attempts. Review them before publishing, or start a new run.`
      return run.fixes.length
        ? `Ready. QA failed on attempt 1; the fixer patched ${run.fixes.reduce((n, f) => n + f.changes.length, 0)} field${run.fixes.reduce((n, f) => n + f.changes.length, 0) === 1 ? '' : 's'} and attempt ${qa.length} passed.`
        : 'Ready. QA passed on the first try. Check the preview and publish.'
    case 'failed':
      return `The run stopped: ${run.error ?? 'unknown error'}. Start a new run with the same brief.`
    case 'fixing':
      return `QA attempt ${run.qaAttempts} found ${last?.issues.length ?? 0} issue${last?.issues.length === 1 ? '' : 's'}. The fixer is patching the copy.`
    case 'qa-running':
      return run.qaAttempts
        ? `Re-testing the fixed page (QA attempt ${run.qaAttempts + 1}).`
        : 'Draft saved. Testing it on mobile against the QA thresholds.'
    default:
      return `${statusLabels[run.status]}…`
  }
}

export function RunView({
  initial,
  admin,
  qaMode,
}: {
  initial: RunPayload
  admin: boolean
  qaMode: 'live' | 'simulated'
}) {
  const [data, setData] = useState(initial)
  const [now, setNow] = useState(() => Date.now())
  const [pollError, setPollError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const lastAnnounced = useRef<string>('')
  const { run } = data
  const running = runningStatuses.includes(run.status)

  // Poll while the run is in progress; stop on ready, published or failed.
  useEffect(() => {
    if (!running) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let failures = 0
    const tick = async () => {
      try {
        const res = await fetch(`/api/factory/runs/${run.id}`, { cache: 'no-store' })
        if (res.status === 404) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          if (!cancelled) setPollError(body.error ?? 'This run no longer exists. Start a new run.')
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const next = (await res.json()) as RunPayload
        if (cancelled) return
        failures = 0
        setPollError(null)
        setData(next)
      } catch {
        failures++
        if (!cancelled && failures >= 2)
          setPollError('Lost contact with the server. Retrying every few seconds.')
      }
      if (!cancelled) timer = setTimeout(tick, Math.min(POLL_MS * 2 ** failures, 10_000))
    }
    timer = setTimeout(tick, POLL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [running, run.id])

  // Clock: ticks until the page is live (or the run failed).
  const stopped = run.status === 'published' || run.status === 'failed'
  useEffect(() => {
    if (stopped) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [stopped])

  // Live region: announce each status change once.
  const latestStep = data.steps.at(-1)
  useEffect(() => {
    const key = `${run.status}:${data.steps.length}`
    if (key === lastAnnounced.current) return
    lastAnnounced.current = key
    const step = latestStep ? ` ${latestStep.summary}` : ''
    setAnnounce(`${statusLabels[run.status]}.${step}`)
  }, [run.status, data.steps.length, latestStep])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const elapsed = useMemo(() => {
    const start = new Date(run.createdAt).getTime()
    if (run.timeToShipMs != null) return run.timeToShipMs
    const end = run.status === 'failed' ? new Date(run.updatedAt).getTime() : Math.max(now, start)
    return end - start
  }, [run.createdAt, run.timeToShipMs, run.status, run.updatedAt, now])

  const publish = useCallback(async () => {
    setPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch(`/api/factory/runs/${run.id}/publish`, { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        run?: RunPayload['run']
        liveUrl?: string
      }
      if (!res.ok || !body.run) {
        setPublishError(body.error ?? `Publishing failed with status ${res.status}. Try again.`)
      } else {
        const fresh = await fetch(`/api/factory/runs/${run.id}`, { cache: 'no-store' })
        if (fresh.ok) setData((await fresh.json()) as RunPayload)
        else setData((d) => ({ ...d, run: body.run!, liveUrl: body.liveUrl ?? d.liveUrl }))
        setToast('Published')
      }
    } catch {
      setPublishError('Could not reach the server. Check your connection and publish again.')
    }
    setPublishing(false)
  }, [run.id])

  const canPublish = run.status === 'ready' && (run.mode === 'demo' || admin)
  const lastQa = data.qa.at(-1)

  return (
    <main className="mx-auto max-w-[90rem] px-4 pt-6 pb-16 sm:px-6">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>

      {/* Title row: what this run is, the clock, the one action. */}
      <div className="flex flex-wrap items-start gap-x-10 gap-y-5 border-b border-line pb-5">
        <div className="min-w-0 flex-1 basis-[28rem]">
          <p className="text-sm text-fg-muted">
            <Link href="/factory/runs" className="underline-offset-4 hover:underline">
              Runs
            </Link>{' '}
            / {run.mode === 'production' ? 'Production run' : 'Demo run'}
          </p>
          <h1 className="mt-1 text-lg sm:text-xl">{run.brief.prospect}</h1>
          <p className="mt-2 text-sm text-fg-muted">
            {siteTypeLabels[run.brief.siteType]} · {run.brief.audience.join(', ')} ·{' '}
            {goalLabels[run.brief.goal]}
          </p>
          <p className="mt-3 flex items-baseline gap-2 text-sm">
            <span className="relative -top-px">
              <StatusMark status={run.status} qaPassed={lastQa?.passed} />
            </span>
            <span>
              <span className="font-semibold">{statusLabels[run.status]}.</span>{' '}
              {headline(data).replace(/^(Live|Ready)\. /, '')}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <p className="text-sm text-fg-muted" id="clock-label">
              Brief → live
            </p>
            <p
              aria-labelledby="clock-label"
              className="text-3xl font-semibold tabular-nums [font-stretch:125%]"
              suppressHydrationWarning
            >
              {formatClock(elapsed)}
            </p>
            <p className="text-xs text-fg-muted">
              {run.status === 'published'
                ? 'Stopped when the page went live'
                : run.status === 'failed'
                  ? 'Stopped when the run failed'
                  : run.status === 'ready'
                    ? 'Still running until you publish'
                    : 'mm:ss since the brief was submitted'}
            </p>
          </div>

          <div className="flex flex-col items-start gap-1.5">
            {run.status === 'published' && data.liveUrl ? (
              <a
                href={data.liveUrl}
                target="_blank"
                rel="noopener"
                className="rounded-control bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:bg-accent-strong"
              >
                Open the live page
              </a>
            ) : (
              <button
                type="button"
                onClick={publish}
                disabled={!canPublish || publishing}
                aria-describedby="publish-help"
                className="rounded-control bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-line disabled:text-fg-muted"
              >
                {publishing ? 'Publishing…' : 'Publish page'}
              </button>
            )}
            <p id="publish-help" className="max-w-56 text-xs text-fg-muted">
              {run.status === 'published'
                ? run.mode === 'production'
                  ? `Live at ${data.liveUrl}`
                  : 'Live in the demo sandbox. Not indexed.'
                : run.status === 'ready'
                  ? run.mode === 'production' && !admin
                    ? 'Only the admin can publish production runs.'
                    : run.mode === 'production'
                      ? 'Publishes to Sanity and the live site.'
                      : 'Publishes to the demo sandbox.'
                  : run.status === 'failed'
                    ? 'Nothing to publish.'
                    : 'Opens once QA has finished.'}
            </p>
          </div>
        </div>
      </div>

      {(pollError || publishError) && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-signal bg-surface-raised px-3 py-2 text-sm"
        >
          {publishError ?? pollError}
        </p>
      )}
      {run.status === 'failed' && (
        <p className="mt-4 text-sm">
          <Link href="/factory" className="underline underline-offset-4">
            Start a new run
          </Link>
        </p>
      )}

      {/* Mobile order: timeline, preview, QA, plan. Desktop: timeline | sticky preview | QA + plan. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 lg:row-span-2 xl:row-span-1">
          <Timeline run={run} steps={data.steps} now={now} />
        </div>
        <div className="min-w-0 lg:sticky lg:top-4">
          <PreviewFrame run={run} />
        </div>
        <div className="min-w-0 space-y-10 lg:col-start-2 xl:col-start-auto">
          <QaPanel run={run} qa={data.qa} qaMode={qaMode} />
          <PlanList plan={run.plan} />
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4"
      >
        {toast && (
          <p className="pointer-events-auto rounded-control bg-fg px-4 py-2.5 text-sm font-semibold text-surface shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
            {toast}
          </p>
        )}
      </div>
    </main>
  )
}
