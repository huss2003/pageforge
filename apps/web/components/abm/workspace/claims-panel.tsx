'use client'

import { useId, useState } from 'react'
import type { Claim, ClaimStatus } from '@/lib/abm/types'
import type { ClaimGroup } from '../claims'
import { displayPath, formatDateTime } from '../format'
import { claimKindLabels, fieldLabel, roleLabels } from '../labels'
import { ClaimStatusLabel, ClaimStatusMark } from '../marks'
import { Button, FieldError, inputClass } from '../ui'

export interface ClaimActions {
  canReview: boolean
  canEdit: boolean
  /** Claim id currently being saved. */
  busy: string | null
  review: (claim: Claim, status: ClaimStatus, note?: string) => Promise<string | null>
  editBlock: (blockKey: string) => void
  locked: boolean
}

function Sources({ claim }: { claim: Claim }) {
  if (claim.kind === 'positioning') {
    return (
      <p className="text-xs text-fg-muted">
        Positioning: an opinion, needs no source and may not contain numbers.
      </p>
    )
  }
  if (!claim.sources.length) {
    return <p className="text-xs font-semibold">No source.</p>
  }
  return (
    <ul className="space-y-1.5">
      {claim.sources.map((s, i) =>
        s.type === 'product_fact' ? (
          <li key={i} className="text-xs">
            <span className="text-fg-muted">Hoverline fact </span>
            <span className="font-medium">{s.label}</span>
          </li>
        ) : (
          <li key={i} className="text-xs">
            <q className="text-fg">{s.quote}</q>{' '}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-fg-muted underline underline-offset-4 hover:text-fg"
            >
              {displayPath(s.url)}
            </a>
          </li>
        ),
      )}
    </ul>
  )
}

function ClaimItem({
  claim,
  actions,
  onHighlight,
}: {
  claim: Claim
  actions: ClaimActions
  onHighlight: (blockKey: string | null, scroll: boolean) => void
}) {
  const noteId = useId()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const busy = actions.busy === claim.id
  const canAct = actions.canReview && !actions.locked

  async function act(status: ClaimStatus) {
    if (status === 'rejected') {
      if (!note.trim()) {
        setError('Say why, so the marketer knows what to fix.')
        document.getElementById(noteId)?.focus()
        return
      }
    }
    setError(null)
    const err = await actions.review(claim, status, status === 'rejected' ? note.trim() : undefined)
    if (err) setError(err)
    else {
      setRejecting(false)
      setNote('')
    }
  }

  const rejected = claim.status === 'rejected'
  return (
    <li
      onMouseEnter={() => onHighlight(claim.blockKey, true)}
      onMouseLeave={() => onHighlight(null, false)}
      onFocus={() => onHighlight(claim.blockKey, true)}
      className={`border-t border-line py-3 first:border-t-0 ${claim.status === 'needs_review' ? 'border-l-2 border-l-signal pl-3' : 'pl-3.5'}`}
    >
      <div className="flex items-start gap-2">
        <ClaimStatusMark status={claim.status} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <p
            className={`text-[0.9375rem] leading-snug ${rejected ? 'text-fg-muted line-through decoration-fg-muted/70' : ''}`}
          >
            {claim.text}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {claimKindLabels[claim.kind]} in {fieldLabel(claim.field).toLowerCase()}
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-2 pl-5">
        <Sources claim={claim} />
        {claim.validator.reasons.length > 0 && (
          <ul className="space-y-0.5 text-xs">
            {claim.validator.reasons.map((r) => (
              <li key={r} className="flex gap-1.5">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${claim.status === 'needs_review' ? 'bg-signal' : 'bg-fg-muted/50'}`}
                />
                <span>
                  <span className="sr-only">Validator: </span>
                  {r}
                </span>
              </li>
            ))}
          </ul>
        )}
        {claim.reviewedBy && (
          <p className="text-xs text-fg-muted">
            <ClaimStatusLabel status={claim.status} /> by{' '}
            {roleLabels[claim.reviewedBy as keyof typeof roleLabels] ?? claim.reviewedBy}
            {claim.reviewedAt && (
              <span className="tabular-nums">, {formatDateTime(claim.reviewedAt)}</span>
            )}
            {claim.note && <span className="block text-fg">&ldquo;{claim.note}&rdquo;</span>}
          </p>
        )}
        {rejected && <p className="text-xs text-fg-muted">Removed from the page.</p>}

        {canAct && !rejecting && claim.status === 'needs_review' && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button
              size="sm"
              onClick={() => act('supported')}
              pending={busy}
              pendingLabel="Saving…"
            >
              Mark supported
            </Button>
            <Button size="sm" onClick={() => setRejecting(true)} disabled={busy}>
              Reject
            </Button>
          </div>
        )}
        {canAct && !rejecting && claim.status === 'supported' && (
          <div className="flex flex-wrap gap-x-4 text-xs">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => act('needs_review')}
              disabled={busy}
              className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
            >
              {busy ? 'Saving…' : 'Back to needs review'}
            </button>
          </div>
        )}
        {canAct && rejecting && (
          <div className="space-y-2 pt-0.5">
            <label htmlFor={noteId} className="block text-xs font-semibold">
              Why is it rejected?
            </label>
            <textarea
              id={noteId}
              rows={2}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${noteId}-err` : undefined}
              placeholder="Not in our approved facts; we have no staffing data."
              className={inputClass}
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="primary"
                onClick={() => act('rejected')}
                pending={busy}
                pendingLabel="Rejecting…"
              >
                Reject and remove
              </Button>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setRejecting(false)
                  setError(null)
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <FieldError id={`${noteId}-err`}>{error}</FieldError>
      </div>
    </li>
  )
}

export function ClaimsPanel({
  groups,
  actions,
  onHighlight,
}: {
  groups: ClaimGroup[]
  actions: ClaimActions
  onHighlight: (blockKey: string | null, scroll: boolean) => void
}) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section
          key={g.blockKey}
          aria-label={`${g.label} claims`}
          onMouseEnter={() => onHighlight(g.blockKey, false)}
          className="rounded-control border border-line bg-surface-raised"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2">
            <h3 className="text-sm font-semibold [font-stretch:100%]">
              {g.label}
              <span className="ml-2 font-normal text-fg-muted tabular-nums">
                {g.claims.length
                  ? `${g.claims.length} ${g.claims.length === 1 ? 'claim' : 'claims'}`
                  : 'No claims'}
              </span>
            </h3>
            {actions.canEdit && g.blockType && (
              <button
                type="button"
                onClick={() => actions.editBlock(g.blockKey)}
                className="text-xs font-semibold underline decoration-line underline-offset-4 hover:decoration-fg"
              >
                Edit copy
              </button>
            )}
          </div>
          {g.claims.length > 0 && (
            <ul className="pr-3.5">
              {g.claims.map((c) => (
                <ClaimItem key={c.id} claim={c} actions={actions} onHighlight={onHighlight} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
