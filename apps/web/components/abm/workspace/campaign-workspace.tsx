'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getCampaign } from '@/lib/abm/client'
import type { CampaignDetail, VersionWithClaims } from '@/lib/abm/types'
import { useDeskSession } from '../desk-shell'
import { industryLabels, typeLabels } from '../labels'
import { CampaignStatus } from '../marks'
import { ErrorNote, Skeleton } from '../ui'
import { BriefStep } from './brief-step'
import { DraftReview } from './draft-review'
import { EngagementStep } from './engagement-step'
import { PublishStep } from './publish-step'
import { SourcesStep } from './sources-step'
import { defaultStep, doneSteps, steps, type StepId } from './steps'

const POLL_MS = 1500

export interface WorkspaceApi {
  campaign: CampaignDetail
  reload: () => Promise<void>
  /** Replace the current version after a claim or edit call. */
  setVersion: (v: VersionWithClaims) => void
  setCampaign: (fn: (c: CampaignDetail) => CampaignDetail) => void
  goTo: (step: StepId) => void
}

export function CampaignWorkspace({
  id,
  initialStep,
  autoGather = false,
}: {
  id: string
  initialStep: StepId | null
  autoGather?: boolean
}) {
  const { session } = useDeskSession()
  const [campaign, setCampaignState] = useState<CampaignDetail | null>(null)
  const [error, setError] = useState<{ message: string; status: number } | null>(null)
  const [step, setStep] = useState<StepId | null>(initialStep)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    try {
      const c = await getCampaign(id)
      if (!mounted.current) return
      setCampaignState(c)
      setError(null)
      setStep((s) => s ?? defaultStep(c, session.role))
    } catch (e) {
      if (!mounted.current) return
      setError({
        message: e instanceof Error ? e.message : 'Could not load this page.',
        status: e instanceof ApiError ? e.status : 0,
      })
    }
  }, [id, session.role])

  useEffect(() => {
    mounted.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    return () => {
      mounted.current = false
    }
  }, [load])

  // Poll while the draft is being written.
  const generating = campaign?.status === 'generating'
  useEffect(() => {
    if (!generating) return
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [generating, load])

  const goTo = useCallback((s: StepId) => {
    setStep(s)
    const url = new URL(window.location.href)
    url.searchParams.set('step', s)
    url.searchParams.delete('gather')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
    window.scrollTo({ top: 0 })
  }, [])

  if (error && !campaign) {
    return (
      <main className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6">
        <p className="text-sm">
          <Link href="/abm" className="text-fg-muted underline-offset-4 hover:underline">
            Account pages
          </Link>
        </p>
        {error.status === 404 ? (
          <>
            <h1 className="mt-1 text-xl">Page not found</h1>
            <p className="mt-2 text-fg-muted">
              This account page does not exist in this workspace. Demo data older than 7 days is
              cleared.
            </p>
          </>
        ) : (
          <ErrorNote className="mt-4" onRetry={load}>
            {error.message}
          </ErrorNote>
        )}
      </main>
    )
  }

  if (!campaign || !step) {
    return (
      <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8" aria-busy="true">
        <span className="sr-only">Loading</span>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-8 w-80 max-w-full" />
        <Skeleton className="mt-6 h-9 w-full" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_28rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </main>
    )
  }

  const api: WorkspaceApi = {
    campaign,
    reload: load,
    setVersion: (v) =>
      setCampaignState((c) => {
        if (!c) return c
        const known = c.versions.some((x) => x.id === v.id)
        if (!known) void load() // A new 'edit' version was created; refresh the list.
        return { ...c, current: v, currentVersionId: v.id }
      }),
    setCampaign: (fn) => setCampaignState((c) => (c ? fn(c) : c)),
    goTo,
  }

  const done = doneSteps(campaign)
  const name =
    campaign.account?.name && campaign.type !== 'solutions'
      ? campaign.account.name
      : `${industryLabels[campaign.industry]} solutions page`

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-5 sm:px-6 sm:py-6">
      <p className="text-sm">
        <Link
          href="/abm"
          className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Account pages
        </Link>
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-xl">{name}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <CampaignStatus status={campaign.status} />
          <span className="text-fg-muted">{typeLabels[campaign.type]}</span>
          {campaign.current && (
            <span className="text-fg-muted tabular-nums">Version {campaign.current.number}</span>
          )}
        </p>
      </div>

      <nav aria-label="Steps" className="mt-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max border-b border-line">
          {steps.map((s, i) => {
            const current = s.id === step
            const finished = done.has(s.id)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  aria-current={current ? 'step' : undefined}
                  className="relative -mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm whitespace-nowrap text-fg-muted hover:text-fg aria-[current=step]:border-accent aria-[current=step]:font-semibold aria-[current=step]:text-fg"
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-5 place-items-center rounded-full text-[0.6875rem] font-semibold tabular-nums ${
                      finished
                        ? 'bg-fg text-surface'
                        : current
                          ? 'border border-accent text-accent'
                          : 'border border-[color-mix(in_oklab,var(--line)_60%,var(--fg))]'
                    }`}
                  >
                    {finished ? (
                      <svg viewBox="0 0 12 12" className="size-2.5">
                        <path
                          d="M2.5 6.3 5 8.6 9.6 3.4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  {s.label}
                  {finished && <span className="sr-only"> (done)</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {error && (
        <ErrorNote className="mt-3" onRetry={load}>
          {error.message}
        </ErrorNote>
      )}

      <div className="mt-5">
        {step === 'brief' && <BriefStep api={api} />}
        {step === 'sources' && <SourcesStep api={api} autoGather={autoGather} />}
        {(step === 'draft' || step === 'review') && <DraftReview api={api} mode={step} />}
        {step === 'publish' && <PublishStep key={campaign.current?.id ?? 'none'} api={api} />}
        {step === 'engagement' && <EngagementStep api={api} />}
      </div>
    </main>
  )
}
