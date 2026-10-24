'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import {
  ApiError,
  duplicateCampaign,
  editVersion,
  pauseCampaign,
  publishCampaign,
  resumeCampaign,
  rollbackCampaign,
} from '@/lib/abm/client'
import type { AccountBrief, SeoConfig } from '@/lib/abm/types'
import { publishBlockers } from '../claims'
import { useDeskSession } from '../desk-shell'
import { displayPath, formatDate, formatDateTime } from '../format'
import { channelLabels, originLabels, roleLabels, versionStateLabels } from '../labels'
import { CampaignStatus } from '../marks'
import { pagePath } from '../paths'
import { Button, CopyButton, Dialog, ErrorNote, FieldError, inputClass, Pill } from '../ui'
import type { WorkspaceApi } from './campaign-workspace'

function Counter({ value, max }: { value: string; max: number }) {
  const over = value.length > max
  return (
    <span className={`tabular-nums ${over ? 'font-semibold text-fg' : ''}`}>
      {value.length} / {max}
    </span>
  )
}

function Section({
  id,
  title,
  children,
  aside,
}: {
  id: string
  title: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold [font-stretch:100%]">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

export function PublishStep({ api }: { api: WorkspaceApi }) {
  const router = useRouter()
  const { campaign: c } = api
  const { can } = useDeskSession()
  const v = c.current
  const canPublish = can('marketer')
  const [seo, setSeo] = useState<Pick<SeoConfig, 'title' | 'description' | 'noindex'>>(() => ({
    title: v?.seo.title ?? '',
    description: v?.seo.description ?? '',
    noindex: v?.seo.noindex ?? true,
  }))
  const [expires, setExpires] = useState(toDateInput(c.expiresAt))
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seoError, setSeoError] = useState<string | null>(null)
  const [dupOpen, setDupOpen] = useState(false)
  const [dup, setDup] = useState({
    companyName: '',
    companyUrl: '',
    targetRole: c.account?.targetRole ?? '',
  })
  const [dupErrors, setDupErrors] = useState<Record<string, string>>({})
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''))

  if (!v) {
    return (
      <div className="border-y border-dashed border-line py-8">
        <p className="font-semibold">Nothing to publish yet.</p>
        <p className="mt-1 text-sm text-fg-muted">A draft has to be written and approved first.</p>
      </div>
    )
  }
  const version = v
  const blockers = publishBlockers(version, { forPublish: true })
  const live = c.status === 'published'
  const paused = c.status === 'paused'
  const isCurrentLive = c.publishedVersionId === version.id
  const seoDirty =
    seo.title !== version.seo.title ||
    seo.description !== version.seo.description ||
    seo.noindex !== version.seo.noindex
  const seoProblem = !seo.title.trim()
    ? 'Add a page title.'
    : seo.title.length > 60
      ? 'Keep the title to 60 characters.'
      : !seo.description.trim()
        ? 'Add a description.'
        : seo.description.length > 160
          ? 'Keep the description to 160 characters.'
          : null
  const path = pagePath(c)
  const url = c.liveUrl ?? `${origin}${path}`
  const expiryIso = expires ? new Date(`${expires}T23:59:59Z`).toISOString() : null

  async function act(kind: string, fn: () => Promise<void>) {
    setPending(kind)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.')
    }
    setPending(null)
  }

  async function saveSeo() {
    if (seoProblem) return setSeoError(seoProblem)
    setSeoError(null)
    await act('seo', async () => {
      api.setVersion(
        await editVersion(version.id, {
          seo: { ...seo, title: seo.title.trim(), description: seo.description.trim() },
        }),
      )
    })
  }

  async function duplicate() {
    const errs: Record<string, string> = {}
    if (!dup.companyName.trim()) errs.companyName = 'Enter the company name.'
    if (!/^https?:\/\/\S+$/i.test(dup.companyUrl.trim()))
      errs.companyUrl = 'Use the full address, starting with https://'
    if (!dup.targetRole.trim()) errs.targetRole = 'Add a job title.'
    setDupErrors(errs)
    if (Object.keys(errs).length) return
    const brief: AccountBrief = {
      companyName: dup.companyName.trim(),
      companyUrl: dup.companyUrl.trim(),
      industry: c.industry,
      campaignType: c.type,
      goal: c.goal,
      painPoints: [],
      targetRole: dup.targetRole.trim(),
      sourceChannel: (c.sourceChannel as AccountBrief['sourceChannel']) ?? 'email',
    }
    setPending('dup')
    try {
      const { campaignId } = await duplicateCampaign(c.id, brief)
      router.push(`/abm/campaigns/${campaignId}?step=sources&gather=1`)
    } catch (e) {
      if (e instanceof ApiError) setDupErrors({ ...e.fields, form: e.message })
      else setDupErrors({ form: 'Could not duplicate the page.' })
      setPending(null)
    }
  }

  const canGoLive = version.state === 'approved' && blockers.length === 0 && !seoDirty

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-6">
        <Section
          id="seo-heading"
          title="Search and sharing"
          aside={
            canPublish && seoDirty ? (
              <span className="text-xs text-fg-muted">Unsaved changes</span>
            ) : undefined
          }
        >
          <div className="grid gap-x-8 gap-y-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <fieldset disabled={!canPublish} className="space-y-4">
              <legend className="sr-only">SEO</legend>
              <div>
                <label htmlFor="seo-title" className="block text-xs font-semibold">
                  Page title
                </label>
                <input
                  id="seo-title"
                  value={seo.title}
                  onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))}
                  className={`${inputClass} mt-1`}
                  aria-describedby="seo-title-meta"
                />
                <p
                  id="seo-title-meta"
                  className="mt-0.5 flex justify-between text-xs text-fg-muted"
                >
                  <span>Shown in the browser tab and search results.</span>
                  <Counter value={seo.title} max={60} />
                </p>
              </div>
              <div>
                <label htmlFor="seo-desc" className="block text-xs font-semibold">
                  Description
                </label>
                <textarea
                  id="seo-desc"
                  rows={3}
                  value={seo.description}
                  onChange={(e) => setSeo((s) => ({ ...s, description: e.target.value }))}
                  className={`${inputClass} mt-1`}
                  aria-describedby="seo-desc-meta"
                />
                <p id="seo-desc-meta" className="mt-0.5 flex justify-end text-xs text-fg-muted">
                  <Counter value={seo.description} max={160} />
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--fg)]"
                  checked={seo.noindex}
                  disabled={c.type === 'demo'}
                  onChange={(e) => setSeo((s) => ({ ...s, noindex: e.target.checked }))}
                />
                <span>
                  Keep out of search engines
                  <span className="block text-xs text-fg-muted">
                    {c.type === 'demo'
                      ? 'Private demo pages are never indexed.'
                      : c.type === 'solutions'
                        ? 'Solutions pages are usually indexed; they are the public baseline.'
                        : 'Campaign pages stay out of search unless you allow them.'}
                  </span>
                </span>
              </label>
              {canPublish && seoDirty && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={saveSeo}
                    pending={pending === 'seo'}
                    pendingLabel="Saving…"
                  >
                    Save search settings
                  </Button>
                  {version.state === 'approved' && (
                    <span className="text-xs text-fg-muted">
                      Starts version {Math.max(...c.versions.map((x) => x.number)) + 1}, which needs
                      approval.
                    </span>
                  )}
                </div>
              )}
              <FieldError id="seo-error">{seoError}</FieldError>
            </fieldset>

            <figure>
              <figcaption className="mb-1.5 text-xs text-fg-muted">Link preview</figcaption>
              <div className="overflow-hidden rounded-media border border-line bg-surface-raised">
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG route, shown as-is */}
                <img
                  src={version.seo.ogImageUrl}
                  alt=""
                  width={1200}
                  height={630}
                  className="aspect-[1200/630] w-full border-b border-line bg-[color-mix(in_oklab,var(--line)_40%,transparent)] object-cover"
                />
                <div className="px-3 py-2">
                  <p className="truncate text-xs text-fg-muted">{displayPath(url).split('?')[0]}</p>
                  <p className="line-clamp-2 text-sm font-semibold">{seo.title || 'Untitled'}</p>
                  <p className="line-clamp-2 text-xs text-fg-muted">{seo.description}</p>
                </div>
              </div>
            </figure>
          </div>
        </Section>

        <Section id="link-heading" title={c.type === 'demo' ? 'Private link' : 'Link'}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 truncate rounded-control border border-line bg-surface-raised px-2.5 py-2 text-sm">
              {url}
            </span>
            <CopyButton value={url} label="Copy link" size="md" />
          </div>
          <p className="mt-1.5 text-xs text-fg-muted">
            {c.type === 'demo'
              ? 'The 12-character token makes it unguessable. A wrong token shows a plain 404.'
              : 'Anyone with the link can open it once it is live.'}
          </p>
          {c.type !== 'solutions' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label htmlFor="expires" className="text-sm font-semibold">
                Expires on
              </label>
              <input
                id="expires"
                type="date"
                value={expires}
                disabled={!canPublish}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExpires(e.target.value)}
                className={`${inputClass} w-44! tabular-nums`}
              />
              <span className="text-xs text-fg-muted">
                After this date visitors see a page saying it is no longer available.
              </span>
            </div>
          )}
        </Section>

        {c.trackingLinks.length > 0 && (
          <Section id="tracking-heading" title="Tracked links">
            <ul className="divide-y divide-line border-y border-line">
              {c.trackingLinks.map((t) => (
                <li
                  key={t.channel}
                  className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="w-32 shrink-0 text-sm font-semibold">
                    {channelLabels[t.channel]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-fg-muted" title={t.url}>
                    {displayPath(t.url)}
                  </span>
                  <CopyButton value={t.url} />
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-fg-muted">
              Each link carries utm_source, utm_medium and utm_campaign, so the lead shows where it
              came from.
            </p>
          </Section>
        )}

        <Section id="versions-heading" title="Versions">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-fg-muted">
                <th scope="col" className="py-1.5 pr-3 font-normal">
                  Version
                </th>
                <th scope="col" className="py-1.5 pr-3 font-normal">
                  State
                </th>
                <th scope="col" className="hidden py-1.5 pr-3 font-normal sm:table-cell">
                  Created
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {c.versions.map((x) => {
                const isLive = x.id === c.publishedVersionId
                return (
                  <tr key={x.id} className="border-t border-line align-baseline">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="font-semibold tabular-nums">{x.number}</span>{' '}
                      <span className="text-fg-muted">{originLabels[x.origin]}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {versionStateLabels[x.state]}{' '}
                      {isLive && <Pill tone="accent">{paused ? 'Published, paused' : 'Live'}</Pill>}
                    </td>
                    <td className="hidden py-2 pr-3 text-fg-muted tabular-nums sm:table-cell">
                      {formatDateTime(x.createdAt)} by{' '}
                      {roleLabels[x.createdBy as keyof typeof roleLabels] ?? x.createdBy}
                    </td>
                    <td className="py-2 text-right">
                      {canPublish && c.publishedVersionId && !isLive && x.state === 'approved' && (
                        <Button
                          size="sm"
                          onClick={() =>
                            act(`rb:${x.id}`, async () => {
                              await rollbackCampaign(c.id, x.id)
                              await api.reload()
                            })
                          }
                          pending={pending === `rb:${x.id}`}
                          pendingLabel="Republishing…"
                        >
                          Roll back to {x.number}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section
          aria-labelledby="golive-heading"
          className="rounded-control border border-line bg-surface-raised p-4"
        >
          <h2 id="golive-heading" className="text-sm font-semibold [font-stretch:100%]">
            {live || paused ? 'On the web' : 'Go live'}
          </h2>
          {(live || paused) && (
            <div className="mt-2 space-y-1 text-sm">
              <p>
                <CampaignStatus status={c.status} />
              </p>
              {c.liveUrl && (
                <a
                  href={c.liveUrl}
                  target="_blank"
                  rel="noopener"
                  className="block truncate underline underline-offset-4"
                >
                  {displayPath(c.liveUrl)}
                </a>
              )}
              <p className="text-fg-muted tabular-nums">
                Version {c.versions.find((x) => x.id === c.publishedVersionId)?.number ?? '–'} since{' '}
                {c.publishedAt ? formatDateTime(c.publishedAt) : '–'}
                {c.expiresAt ? `, expires ${formatDate(c.expiresAt)}` : ''}
              </p>
            </div>
          )}

          {!isCurrentLive && (
            <>
              {blockers.length > 0 || seoDirty ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {blockers.map((b) => (
                    <li key={b.id} className="flex gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-signal"
                      />
                      {b.text}
                    </li>
                  ))}
                  {seoDirty && (
                    <li className="flex gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-signal"
                      />
                      Search settings are not saved
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-fg-muted">
                  Version {version.number} is approved with{' '}
                  {version.claims.filter((x) => x.status === 'supported').length} supported claims
                  and nothing left to review.
                </p>
              )}
              {canPublish ? (
                <Button
                  variant="primary"
                  className="mt-3 w-full"
                  disabled={!canGoLive}
                  pending={pending === 'publish'}
                  pendingLabel="Publishing…"
                  onClick={() =>
                    act('publish', async () => {
                      await publishCampaign(c.id, version.id, { expiresAt: expiryIso })
                      await api.reload()
                    })
                  }
                >
                  {c.publishedVersionId ? `Publish version ${version.number}` : 'Publish'}
                </Button>
              ) : (
                <p className="mt-3 text-xs text-fg-muted">Marketers publish approved versions.</p>
              )}
            </>
          )}

          {canPublish && (live || paused) && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              {live ? (
                <Button
                  size="sm"
                  onClick={() =>
                    act('pause', async () => {
                      await pauseCampaign(c.id)
                      await api.reload()
                    })
                  }
                  pending={pending === 'pause'}
                  pendingLabel="Pausing…"
                >
                  Pause page
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() =>
                    act('resume', async () => {
                      await resumeCampaign(c.id)
                      await api.reload()
                    })
                  }
                  pending={pending === 'resume'}
                  pendingLabel="Resuming…"
                >
                  Resume page
                </Button>
              )}
              {c.type !== 'solutions' && (
                <Button size="sm" onClick={() => setDupOpen(true)}>
                  Duplicate for another account
                </Button>
              )}
            </div>
          )}
          {paused && (
            <p className="mt-2 text-xs text-fg-muted">
              Visitors see a short note that the page is no longer available, with a 410 status.
            </p>
          )}
          {error && <ErrorNote className="mt-3">{error}</ErrorNote>}
        </section>
      </aside>

      <Dialog
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        title="Duplicate for another account"
      >
        <p className="text-sm text-fg-muted">
          The copy keeps the page structure and Hoverline claims. Account facts are cleared and
          every claim that used them goes back to review.
        </p>
        <div className="mt-4 space-y-3">
          {(
            [
              ['companyName', 'Company', 'text'],
              ['companyUrl', 'Website', 'url'],
              ['targetRole', 'Who reads it', 'text'],
            ] as const
          ).map(([k, label, type]) => (
            <div key={k}>
              <label htmlFor={`dup-${k}`} className="block text-sm font-semibold">
                {label}
              </label>
              <input
                id={`dup-${k}`}
                type={type}
                value={dup[k]}
                onChange={(e) => setDup((d) => ({ ...d, [k]: e.target.value }))}
                aria-invalid={Boolean(dupErrors[k])}
                aria-describedby={dupErrors[k] ? `dup-${k}-err` : undefined}
                className={`${inputClass} mt-1`}
              />
              <FieldError id={`dup-${k}-err`}>{dupErrors[k]}</FieldError>
            </div>
          ))}
          <FieldError id="dup-form-err">{dupErrors.form}</FieldError>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setDupOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={duplicate}
            pending={pending === 'dup'}
            pendingLabel="Duplicating…"
          >
            Duplicate and read their site
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
