'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ApiError,
  approveVersion,
  editVersion,
  requestChanges,
  reviewClaim,
  submitVersion,
} from '@/lib/abm/client'
import type { Claim, ClaimStatus, CtaConfig } from '@/lib/abm/types'
import { claimCounts, groupClaimsByBlock, publishBlockers, type Blocker } from '../claims'
import { useDeskSession } from '../desk-shell'
import { originLabels, versionStateLabels } from '../labels'
import { Button, Dialog, ErrorNote, FieldError, inputClass } from '../ui'
import { BlockEditor } from './block-editor'
import type { WorkspaceApi } from './campaign-workspace'
import { ClaimsPanel } from './claims-panel'
import { PreviewFrame } from './preview-frame'

function Blockers({
  blockers,
  forPublish,
  onPick,
}: {
  blockers: Blocker[]
  forPublish: boolean
  onPick: (b: Blocker) => void
}) {
  return (
    <section
      aria-labelledby="blockers-heading"
      aria-live="polite"
      className={`rounded-control border px-3.5 py-3 ${blockers.length ? 'border-[color-mix(in_oklab,var(--color-signal)_55%,var(--line))] bg-[color-mix(in_oklab,var(--color-signal)_7%,var(--surface))]' : 'border-line bg-surface-raised'}`}
    >
      <h2 id="blockers-heading" className="text-sm font-semibold [font-stretch:100%]">
        {blockers.length
          ? `${forPublish ? 'Publish' : 'Approval'} blocked by ${blockers.length} ${blockers.length === 1 ? 'item' : 'items'}`
          : forPublish
            ? 'Nothing blocks publishing'
            : 'Nothing blocks approval'}
      </h2>
      {blockers.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-sm">
          {blockers.map((b) => (
            <li key={b.id} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-signal" />
              {b.blockKey ? (
                <button
                  type="button"
                  onClick={() => onPick(b)}
                  className="text-left underline decoration-line underline-offset-4 hover:decoration-fg"
                >
                  {b.text}
                </button>
              ) : (
                <span>{b.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CtaSettings({
  cta,
  disabled,
  onSave,
}: {
  cta: CtaConfig
  disabled: boolean
  onSave: (cta: CtaConfig) => Promise<string | null>
}) {
  const [draft, setDraft] = useState(cta)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(cta)
  const labelError = !draft.label.trim()
    ? 'Name the action, like "Book a walkthrough".'
    : draft.label.length > 32
      ? 'Keep the label to 32 characters.'
      : null
  const optional: CtaConfig['formFields'] = ['role', 'phone', 'siteCount', 'message']
  const names = { role: 'Role', phone: 'Phone', siteCount: 'Number of sites', message: 'Message' }

  async function save() {
    if (labelError) return
    setPending(true)
    setError(await onSave({ ...draft, label: draft.label.trim() }))
    setPending(false)
  }

  return (
    <section
      aria-labelledby="cta-heading"
      className="rounded-control border border-line bg-surface-raised px-3.5 py-3"
    >
      <h2 id="cta-heading" className="text-sm font-semibold [font-stretch:100%]">
        Call to action
      </h2>
      <fieldset disabled={disabled} className="mt-2 space-y-3">
        <legend className="sr-only">What the closing section asks for</legend>
        <div className="grid grid-cols-2 rounded-control border border-line p-0.5 text-sm">
          {(['calendar', 'form'] as const).map((k) => (
            <label
              key={k}
              className="cursor-pointer rounded-[2px] px-2 py-1.5 text-center has-[:checked]:bg-fg has-[:checked]:text-surface has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name="cta-kind"
                className="sr-only"
                checked={draft.kind === k}
                onChange={() => setDraft((d) => ({ ...d, kind: k }))}
              />
              {k === 'calendar' ? 'Book a slot' : 'Lead form'}
            </label>
          ))}
        </div>
        <div>
          <label htmlFor="cta-label" className="block text-xs font-semibold">
            Button label
          </label>
          <input
            id="cta-label"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            aria-invalid={Boolean(labelError)}
            aria-describedby="cta-label-meta"
            className={`${inputClass} mt-1`}
          />
          <p id="cta-label-meta" className="mt-0.5 flex justify-between text-xs text-fg-muted">
            <span>{labelError ?? 'Say what happens when they click.'}</span>
            <span className="tabular-nums">{draft.label.length} / 32</span>
          </p>
        </div>
        {draft.kind === 'form' && (
          <div>
            <p className="text-xs font-semibold">Extra fields</p>
            <p className="text-xs text-fg-muted">Name, work email and company are always asked.</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {optional.map((f) => (
                <label key={f} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--fg)]"
                    checked={draft.formFields.includes(f)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        formFields: e.target.checked
                          ? [...d.formFields, f]
                          : d.formFields.filter((x) => x !== f),
                      }))
                    }
                  />
                  {names[f]}
                </label>
              ))}
            </div>
          </div>
        )}
        {dirty && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={save}
              pending={pending}
              pendingLabel="Saving…"
              disabled={Boolean(labelError)}
            >
              Save call to action
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setDraft(cta)} disabled={pending}>
              Undo
            </Button>
          </div>
        )}
        <FieldError id="cta-error">{error}</FieldError>
      </fieldset>
    </section>
  )
}

export function DraftReview({ api, mode }: { api: WorkspaceApi; mode: 'draft' | 'review' }) {
  const { campaign: c } = api
  const { can, session } = useDeskSession()
  const v = c.current
  const [highlight, setHighlight] = useState<{ key: string | null; scroll: boolean }>({
    key: null,
    scroll: false,
  })
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState<'submit' | 'approve' | 'send-back' | null>(null)
  const [sendBack, setSendBack] = useState(false)
  const [sendNote, setSendNote] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)

  const onHighlight = useCallback((key: string | null, scroll: boolean) => {
    setHighlight((h) => (h.key === key && h.scroll === scroll ? h : { key, scroll }))
  }, [])

  const groups = useMemo(() => (v ? groupClaimsByBlock(v.page, v.claims) : []), [v])
  const counts = useMemo(() => claimCounts(v?.claims ?? []), [v])
  const blockers = useMemo(
    () => (v ? publishBlockers(v, { forPublish: mode === 'draft' }) : []),
    [v, mode],
  )

  if (!v) {
    return (
      <div className="border-y border-dashed border-line py-8">
        <p className="font-semibold">No draft yet.</p>
        <p className="mt-1 text-sm text-fg-muted">
          {c.status === 'generating'
            ? 'The writer is working on it. This view updates when it is ready.'
            : 'Gather sources and generate a draft first.'}
        </p>
        {c.status !== 'generating' && can('marketer') && (
          <Button variant="primary" className="mt-4" onClick={() => api.goTo('sources')}>
            Go to sources
          </Button>
        )}
      </div>
    )
  }

  const version = v
  const canEdit = can('marketer')
  const canReview = can('reviewer')
  const locked = version.state === 'approved'
  const approvalBlockers = publishBlockers(version, { forPublish: false })

  async function review(claim: Claim, status: ClaimStatus, note?: string): Promise<string | null> {
    setBusy(claim.id)
    try {
      api.setVersion(await reviewClaim(claim.id, status, note))
      setBusy(null)
      return null
    } catch (e) {
      setBusy(null)
      return e instanceof ApiError ? (e.fields.note ?? e.message) : 'Could not save the review.'
    }
  }

  async function saveFields(blockKey: string, changes: { field: string; value: string }[]) {
    try {
      api.setVersion(
        await editVersion(
          version.id,
          changes.map((ch) => ({ blockKey, ...ch })),
        ),
      )
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save.'
    }
  }

  async function saveCta(cta: CtaConfig) {
    try {
      api.setVersion(await editVersion(version.id, { cta }))
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save.'
    }
  }

  async function run(kind: 'submit' | 'approve') {
    setPending(kind)
    setActionError(null)
    try {
      const next =
        kind === 'submit' ? await submitVersion(version.id) : await approveVersion(version.id)
      api.setVersion(next)
      await api.reload()
      if (kind === 'approve') api.goTo(can('marketer') ? 'publish' : 'review')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'That did not work. Try again.')
    }
    setPending(null)
  }

  async function doSendBack() {
    if (!sendNote.trim()) {
      setSendError('Say what needs to change.')
      return
    }
    setPending('send-back')
    setSendError(null)
    try {
      api.setVersion(await requestChanges(version.id, sendNote.trim()))
      await api.reload()
      setSendBack(false)
      setSendNote('')
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Could not send it back.')
    }
    setPending(null)
  }

  const editBlock = editing ? version.page.blocks.find((b) => b._key === editing) : null
  const editGroup = groups.find((g) => g.blockKey === editing)

  const summary = [
    `${counts.total} ${counts.total === 1 ? 'claim' : 'claims'}`,
    `${counts.supported} supported`,
    counts.needs_review ? `${counts.needs_review} to review` : null,
    counts.rejected ? `${counts.rejected} rejected` : null,
  ].filter(Boolean)

  const reviewerBar = canReview && (mode === 'review' || !canEdit)
  const marketerBar = canEdit && (mode === 'draft' || !canReview)

  return (
    <div className="grid gap-x-6 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)]">
      <div className="lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:self-start">
        <PreviewFrame
          page={version.page}
          cta={version.cta}
          accountName={c.type === 'solutions' ? null : (c.account?.name ?? null)}
          highlight={highlight.key}
          scrollToHighlight={highlight.scroll}
          onHoverBlock={(k) => onHighlight(k, false)}
          title={`Preview of version ${version.number}`}
        />
      </div>

      <div className="order-first min-w-0 space-y-4 lg:order-none">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="text-sm">
            <p>
              <span className="font-semibold">Version {version.number}</span>{' '}
              <span className="text-fg-muted">
                {originLabels[version.origin]}
                {version.simulated
                  ? ', simulated writer'
                  : version.model
                    ? `, ${version.model}`
                    : ''}
              </span>
            </p>
            <p className="text-fg-muted">
              {versionStateLabels[version.state]}.{' '}
              <span className="tabular-nums">{summary.join(', ')}</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {marketerBar &&
              (version.state === 'draft' || version.state === 'changes_requested') && (
                <Button
                  variant="primary"
                  onClick={() => run('submit')}
                  pending={pending === 'submit'}
                  pendingLabel="Submitting…"
                >
                  Submit for review
                </Button>
              )}
            {marketerBar && version.state === 'approved' && (
              <Button variant="primary" onClick={() => api.goTo('publish')}>
                Go to publish
              </Button>
            )}
            {reviewerBar && !locked && (
              <>
                <Button onClick={() => setSendBack(true)} disabled={pending !== null}>
                  Send back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => run('approve')}
                  disabled={approvalBlockers.length > 0}
                  pending={pending === 'approve'}
                  pendingLabel="Approving…"
                  title={
                    approvalBlockers.length
                      ? 'Clear the items under "Approval blocked" first.'
                      : undefined
                  }
                >
                  Approve version {version.number}
                </Button>
              </>
            )}
          </div>
        </div>

        {marketerBar && version.state === 'in_review' && !reviewerBar && (
          <p className="text-sm text-fg-muted">
            With the reviewer.{' '}
            {session.workspace === 'demo' &&
              'Switch to Reviewer in the header to review it yourself.'}
          </p>
        )}
        {reviewerBar && version.state === 'draft' && (
          <p className="text-sm text-fg-muted">
            The marketer has not submitted this version yet. You can still review claims.
          </p>
        )}
        {actionError && <ErrorNote>{actionError}</ErrorNote>}

        <Blockers
          blockers={mode === 'review' ? approvalBlockers : blockers}
          forPublish={mode === 'draft'}
          onPick={(b) => {
            onHighlight(b.blockKey ?? null, true)
            if (canEdit && b.blockKey && b.kind === 'field') setEditing(b.blockKey)
          }}
        />

        {mode === 'draft' && canEdit && (
          <CtaSettings
            key={JSON.stringify(version.cta)}
            cta={version.cta}
            disabled={false}
            onSave={saveCta}
          />
        )}

        {editBlock && editGroup ? (
          <BlockEditor
            key={`${version.id}:${editBlock._key}`}
            block={editBlock}
            label={editGroup.label}
            claims={editGroup.claims}
            willFork={locked}
            onSave={(ch) => saveFields(editBlock._key, ch)}
            onClose={() => setEditing(null)}
            onFocusField={() => onHighlight(editBlock._key, true)}
          />
        ) : (
          <ClaimsPanel
            groups={groups}
            onHighlight={onHighlight}
            actions={{ canReview, canEdit, busy, review, editBlock: setEditing, locked }}
          />
        )}
        {locked && canReview && (
          <p className="text-xs text-fg-muted">
            This version is approved, so its claims are locked. An edit starts a new version for
            review.
          </p>
        )}
      </div>

      <Dialog
        open={sendBack}
        onClose={() => setSendBack(false)}
        title={`Send version ${version.number} back`}
      >
        <label htmlFor="send-back-note" className="block text-sm font-semibold">
          What needs to change?
        </label>
        <textarea
          id="send-back-note"
          rows={3}
          value={sendNote}
          onChange={(e) => setSendNote(e.target.value)}
          aria-invalid={Boolean(sendError)}
          aria-describedby={sendError ? 'send-back-err' : undefined}
          className={`${inputClass} mt-1.5`}
        />
        <FieldError id="send-back-err">{sendError}</FieldError>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setSendBack(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={doSendBack}
            pending={pending === 'send-back'}
            pendingLabel="Sending…"
          >
            Send back to marketing
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
