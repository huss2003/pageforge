import Link from 'next/link'
import { siteTypeLabels } from '@/lib/factory/brief-data'
import { formatClock, formatRelative } from '@/lib/factory/format'
import { statusLabels } from '@/lib/factory/labels'
import type { RunSummary } from '@/lib/factory/types'
import { StatusMark } from './status-mark'

/** Runs as rules and alignment: grey sentence-case headers, numbers right-aligned. */
export function RunTable({
  runs,
  compact = false,
  now,
}: {
  runs: RunSummary[]
  compact?: boolean
  now: number
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className={`w-full border-collapse text-sm ${compact ? '' : 'min-w-[34rem]'}`}>
        <thead>
          <tr className="text-left text-xs text-fg-muted">
            <th scope="col" className="py-2 pr-3 font-normal">
              Prospect
            </th>
            <th scope="col" className="py-2 pr-3 font-normal">
              Status
            </th>
            {!compact && (
              <th scope="col" className="py-2 pr-3 font-normal">
                Model
              </th>
            )}
            <th scope="col" className="py-2 pr-3 text-right font-normal">
              QA tries
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">
              Brief to live
            </th>
            <th
              scope="col"
              className={`py-2 text-right font-normal ${compact ? 'hidden sm:table-cell' : ''}`}
            >
              Started
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="max-w-0 py-2.5 pr-3 sm:w-1/2">
                <Link
                  href={`/factory/runs/${r.id}`}
                  className="block truncate font-medium underline-offset-4 hover:underline"
                  title={r.prospect}
                >
                  {r.prospect}
                </Link>
                <span className="text-xs text-fg-muted">
                  {siteTypeLabels[r.siteType]}
                  {r.mode === 'production' ? ' · Production' : ''}
                </span>
              </td>
              <td className="py-2.5 pr-3 whitespace-nowrap">
                <StatusMark status={r.status} qaPassed={r.qaPassed} />
                <span className="ml-1.5">{statusLabels[r.status]}</span>
              </td>
              {!compact && (
                <td className="py-2.5 pr-3 whitespace-nowrap text-fg-muted">
                  {r.model ?? <span aria-label="none">–</span>}
                </td>
              )}
              <td className="py-2.5 pr-3 text-right tabular-nums">
                {r.qaAttempts || <span className="text-fg-muted">–</span>}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums">
                {r.timeToShipMs != null ? (
                  formatClock(r.timeToShipMs)
                ) : (
                  <span className="text-fg-muted">–</span>
                )}
              </td>
              <td
                className={`py-2.5 text-right whitespace-nowrap text-fg-muted tabular-nums ${compact ? 'hidden sm:table-cell' : ''}`}
              >
                <time dateTime={r.createdAt}>{formatRelative(r.createdAt, now)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
