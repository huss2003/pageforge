import type { Lead } from '@/lib/abm/types'

/** "HubSpot, synced" / "Built-in CRM" / "HubSpot sync failed" with the reason. */
export function CrmStatus({ lead }: { lead: Lead }) {
  const provider = lead.crmProvider === 'hubspot' ? 'HubSpot' : 'Built-in CRM'
  if (lead.crmStatus === 'failed') {
    return (
      <span className="block">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true" className="size-2 rounded-full bg-signal" />
          {provider} sync failed
        </span>
        {lead.crmError && <span className="block text-xs text-fg-muted">{lead.crmError}</span>}
      </span>
    )
  }
  if (lead.crmStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span aria-hidden="true" className="size-2 rounded-full border border-fg-muted" />
        {provider}, syncing
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
        <path
          d="M2.5 6.3 5 8.6 9.6 3.4"
          fill="none"
          stroke="var(--color-contour)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {provider}
      {lead.crmProvider === 'hubspot' && lead.crmId && (
        <span className="text-xs text-fg-muted tabular-nums">#{lead.crmId}</span>
      )}
    </span>
  )
}
