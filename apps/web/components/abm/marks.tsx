import type { CampaignStatus, ClaimStatus } from '@/lib/abm/types'
import { claimStatusLabels, statusLabels } from './labels'

/** PageForge mark: a flight route with three waypoints, drawn in the route colour. */
export function RouteMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M3 19 L9 9 L15 14 L21 4"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="3" cy="19" r="2.2" fill="var(--accent)" />
      <circle
        cx="9"
        cy="9"
        r="2.2"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="1.6"
      />
      <circle
        cx="15"
        cy="14"
        r="2.2"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="1.6"
      />
      <circle cx="21" cy="4" r="2.2" fill="var(--accent)" />
    </svg>
  )
}

const dot = 'inline-block size-2 shrink-0 rounded-full'

/**
 * Campaign status: magenta only when the route reached its end (live);
 * amber when a person has to act (in review); outlined while in progress.
 */
export function CampaignStatusMark({ status }: { status: CampaignStatus }) {
  const cls =
    status === 'published'
      ? 'bg-accent'
      : status === 'in_review'
        ? 'bg-signal'
        : status === 'approved'
          ? 'bg-fg'
          : status === 'generating'
            ? 'border-2 border-accent motion-safe:animate-pulse'
            : status === 'paused' || status === 'expired'
              ? 'border-2 border-fg-muted'
              : 'border border-fg-muted'
  return <span aria-hidden="true" className={`${dot} ${cls}`} />
}

export function CampaignStatus({ status }: { status: CampaignStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <CampaignStatusMark status={status} />
      {statusLabels[status]}
    </span>
  )
}

/** Claim status: supported = sage tick, needs review = amber, rejected = struck ink. */
export function ClaimStatusMark({
  status,
  className,
}: {
  status: ClaimStatus
  className?: string
}) {
  if (status === 'supported') {
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true" className={`size-3 shrink-0 ${className ?? ''}`}>
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
  }
  if (status === 'needs_review') {
    return <span aria-hidden="true" className={`${dot} size-2.5 bg-signal ${className ?? ''}`} />
  }
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={`size-3 shrink-0 ${className ?? ''}`}>
      <path d="M3 3l6 6M9 3l-6 6" stroke="var(--fg-muted)" strokeWidth="1.6" />
    </svg>
  )
}

export function ClaimStatusLabel({ status }: { status: ClaimStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <ClaimStatusMark status={status} />
      {claimStatusLabels[status]}
    </span>
  )
}
