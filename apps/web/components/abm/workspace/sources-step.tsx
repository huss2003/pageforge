'use client'

import { useEffect, useRef, useState } from 'react'
import { ApiError, gatherSources, generateDraft, setFactsIncluded } from '@/lib/abm/client'
import type { FactCategory, Source, SourceFact } from '@/lib/abm/types'
import { useDeskSession } from '../desk-shell'
import { displayPath, formatClock, plural } from '../format'
import { categoryLabels, sourceStatusLabels } from '../labels'
import { Button, ErrorNote, Skeleton } from '../ui'
import type { WorkspaceApi } from './campaign-workspace'

function SourceMark({ status }: { status: Source['status'] }) {
  if (status === 'ok')
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true" className="mt-1 size-3 shrink-0">
        <path
          d="M2.5 6.3 5 8.6 9.6 3.4"
          fill="none"
          stroke="var(--color-contour)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  return (
    <span
      aria-hidden="true"
      className="mt-1.5 size-2 shrink-0 rounded-full border-2 border-signal"
    />
  )
}

const categoryOrder: FactCategory[] = ['scale', 'operations', 'challenges', 'initiatives', 'other']

export function SourcesStep({ api, autoGather }: { api: WorkspaceApi; autoGather: boolean }) {
  const { campaign: c } = api
  const { can } = useDeskSession()
  const canEdit = can('marketer')
  const [gathering, setGathering] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyFact, setBusyFact] = useState<string | null>(null)
  const startedAuto = useRef(false)
  const sawGenerating = useRef(c.status === 'generating')
  const [now, setNow] = useState(() => Date.now())
  // The campaign's updatedAt is when drafting started; it does not move while generating.
  const genStart = new Date(c.updatedAt).getTime()

  async function gather() {
    setGathering(true)
    setError(null)
    try {
      const res = await gatherSources(c.id)
      api.setCampaign((x) => ({ ...x, sources: res.sources, facts: res.facts }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the website.')
    }
    setGathering(false)
  }

  useEffect(() => {
    if (!autoGather || startedAuto.current || !canEdit) return
    if (c.sources.length || c.type === 'solutions') return
    startedAuto.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void gather()
    // gather reads the latest campaign through api; run once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGather, canEdit])

  const generating = c.status === 'generating'
  const hasDraft = Boolean(c.current)
  useEffect(() => {
    if (generating) {
      sawGenerating.current = true
      const t = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(t)
    }
    if (sawGenerating.current && hasDraft) {
      sawGenerating.current = false
      api.goTo('draft')
    }
  }, [generating, hasDraft, api])

  async function toggle(f: SourceFact) {
    const included = !f.included
    setBusyFact(f.id)
    setError(null)
    api.setCampaign((x) => ({
      ...x,
      facts: x.facts.map((y) => (y.id === f.id ? { ...y, included } : y)),
    }))
    try {
      const res = await setFactsIncluded(c.id, [{ factId: f.id, included }])
      api.setCampaign((x) => ({ ...x, facts: res.facts }))
    } catch (e) {
      api.setCampaign((x) => ({
        ...x,
        facts: x.facts.map((y) => (y.id === f.id ? { ...y, included: !included } : y)),
      }))
      setError(e instanceof Error ? e.message : 'Could not save that change.')
    }
    setBusyFact(null)
  }

  async function draft() {
    setDrafting(true)
    setError(null)
    try {
      await generateDraft(c.id)
      sawGenerating.current = true
      api.setCampaign((x) => ({ ...x, status: 'generating' }))
      await api.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start the draft.')
    }
    setDrafting(false)
  }

  const included = c.facts.filter((f) => f.included).length
  const okPages = c.sources.filter((s) => s.status === 'ok').length
  const bySource = new Map(c.sources.map((s) => [s.id, s]))
  const facts = [...c.facts].sort(
    (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
  )
  const solutions = c.type === 'solutions'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[70ch] text-sm text-fg-muted">
          {solutions
            ? 'Solutions pages draw only on approved Hoverline facts. Generate the draft when ready.'
            : c.sources.length
              ? `${okPages} of ${c.sources.length} pages read. ${included} of ${c.facts.length} sentences will go to the writer, together with Hoverline's approved product facts.`
              : `Nothing read yet. We fetch ${c.account?.domain ?? 'the site'} and up to three linked pages, respecting robots.txt.`}
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {!solutions && (
              <Button
                onClick={gather}
                pending={gathering}
                pendingLabel="Reading…"
                disabled={generating || drafting}
              >
                {c.sources.length ? 'Read again' : 'Gather sources'}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={draft}
              pending={drafting}
              pendingLabel="Starting…"
              disabled={generating || gathering || (!solutions && included === 0)}
            >
              {c.current ? 'Write a new draft' : 'Generate draft'}
            </Button>
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="text-sm text-fg-muted">
          Marketers gather sources and start drafts. You can read what was found.
        </p>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      {generating && (
        <section
          aria-live="polite"
          className="border-l-2 border-accent bg-surface-raised px-4 py-3"
        >
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 font-semibold">
            Writing the draft
            <span className="text-sm font-normal text-fg-muted tabular-nums">
              {formatClock(Math.max(0, now - genStart))} elapsed
            </span>
          </p>
          <p className="mt-1 max-w-[70ch] text-sm text-fg-muted">
            The writer can only use the blocks in the Hoverline library, approved product facts and
            the {included} sentences you kept. Every factual statement comes back as a claim with
            its source, then the validator checks numbers against the source text. This usually
            takes under 90 seconds; you can leave this page.
          </p>
        </section>
      )}

      {!solutions && (
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <section aria-labelledby="pages-heading">
            <h2 id="pages-heading" className="text-sm font-semibold [font-stretch:100%]">
              Pages read
            </h2>
            {gathering && !c.sources.length ? (
              <ul className="mt-2 border-t border-line" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="border-b border-line py-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-1.5 h-3 w-56" />
                  </li>
                ))}
              </ul>
            ) : c.sources.length ? (
              <ul className="mt-2 border-t border-line">
                {c.sources.map((s) => (
                  <li key={s.id} className="flex gap-2.5 border-b border-line py-2.5 text-sm">
                    <SourceMark status={s.status} />
                    <div className="min-w-0">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate font-medium underline-offset-4 hover:underline"
                        title={s.url}
                      >
                        {s.title ?? displayPath(s.url)}
                      </a>
                      <p className="truncate text-xs text-fg-muted">{displayPath(s.url)}</p>
                      {s.status !== 'ok' && (
                        <p className="mt-1 text-xs">
                          <span className="font-semibold">{sourceStatusLabels[s.status]}.</span>{' '}
                          {s.detail}
                        </p>
                      )}
                      {s.status === 'ok' && (
                        <p className="text-xs text-fg-muted tabular-nums">
                          {plural(c.facts.filter((f) => f.sourceId === s.id).length, 'sentence')}{' '}
                          kept
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 border-y border-dashed border-line py-4 text-sm text-fg-muted">
                No pages read yet.
              </p>
            )}
            <p className="mt-3 text-xs text-fg-muted">
              Only public pages are fetched. Private and internal addresses are refused, and only
              the sentences below are stored, never the page itself.
            </p>
          </section>

          <section aria-labelledby="facts-heading" className="min-w-0">
            <h2 id="facts-heading" className="text-sm font-semibold [font-stretch:100%]">
              Account facts{' '}
              <span className="font-normal text-fg-muted">word for word from the source</span>
            </h2>
            {gathering && !c.facts.length ? (
              <ul className="mt-2 border-t border-line" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="border-b border-line py-3.5">
                    <Skeleton className="h-4 w-full max-w-xl" />
                    <Skeleton className="mt-2 h-3 w-48" />
                  </li>
                ))}
              </ul>
            ) : facts.length ? (
              <ul className="mt-2 border-t border-line">
                {facts.map((f) => {
                  const src = bySource.get(f.sourceId)
                  const inputId = `fact-${f.id}`
                  return (
                    <li
                      key={f.id}
                      className={`grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 border-b border-line py-3 ${f.included ? '' : 'text-fg-muted'}`}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={f.included}
                        disabled={!canEdit || busyFact === f.id || generating}
                        onChange={() => toggle(f)}
                        className="mt-1 size-4 accent-[var(--fg)]"
                        aria-describedby={`${inputId}-meta`}
                      />
                      <div className="min-w-0">
                        <label
                          htmlFor={inputId}
                          className={`block text-[0.9375rem] ${f.included ? '' : 'line-through decoration-fg-muted/60'}`}
                        >
                          &ldquo;{f.quote}&rdquo;
                        </label>
                        <p
                          id={`${inputId}-meta`}
                          className="mt-1 flex flex-wrap gap-x-3 text-xs text-fg-muted"
                        >
                          <span>{categoryLabels[f.category]}</span>
                          {src && (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-4 hover:text-fg"
                            >
                              {displayPath(src.url)}
                            </a>
                          )}
                          {!f.included && <span>Left out of the draft</span>}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : c.sources.length ? (
              <p className="mt-2 border-y border-dashed border-line py-4 text-sm text-fg-muted">
                No usable sentences were found. The draft can still be written from
                Hoverline&rsquo;s product facts, or try another page of their site.
              </p>
            ) : (
              <p className="mt-2 border-y border-dashed border-line py-4 text-sm text-fg-muted">
                Facts appear here once the website has been read.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
