'use client'

import type { ReactNode } from 'react'
import { useDeskSession } from '../desk-shell'
import { formatDate, formatDateTime } from '../format'
import { channelLabels, goalLabels, industryLabels, typeHelp, typeLabels } from '../labels'
import { Button } from '../ui'
import type { WorkspaceApi } from './campaign-workspace'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-0.5 border-t border-line py-2.5 sm:grid-cols-[11rem_1fr]">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

export function BriefStep({ api }: { api: WorkspaceApi }) {
  const { campaign: c } = api
  const { can } = useDeskSession()
  const a = c.account
  const dash = <span className="text-fg-muted">–</span>
  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,48rem)_1fr]">
      <section aria-labelledby="brief-heading">
        <h2 id="brief-heading" className="text-sm font-semibold [font-stretch:100%]">
          Brief
        </h2>
        <dl className="mt-2 border-b border-line">
          {a && c.type !== 'solutions' && (
            <>
              <Row label="Company">{a.name}</Row>
              <Row label="Website">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline underline-offset-4"
                >
                  {a.url}
                </a>
              </Row>
            </>
          )}
          <Row label="Industry">{industryLabels[c.industry]}</Row>
          {a && (
            <Row label="Sites">
              {a.siteCount != null ? <span className="tabular-nums">{a.siteCount}</span> : dash}
            </Row>
          )}
          <Row label="Page type">
            {typeLabels[c.type]}
            <span className="block text-xs text-fg-muted">{typeHelp[c.type]}</span>
          </Row>
          <Row label="Goal">{goalLabels[c.goal]}</Row>
          <Row label="Main channel">
            {c.sourceChannel
              ? (channelLabels[c.sourceChannel as keyof typeof channelLabels] ?? c.sourceChannel)
              : dash}
          </Row>
          {a && <Row label="Who reads it">{a.targetRole ?? dash}</Row>}
          {a && (
            <Row label="Pain points">
              {a.painPoints.length ? (
                <ul className="list-disc space-y-0.5 pl-4">
                  {a.painPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                dash
              )}
            </Row>
          )}
          {a && (
            <Row label="Sales notes">
              {a.salesNotes ? <span className="whitespace-pre-line">{a.salesNotes}</span> : dash}
            </Row>
          )}
          <Row label="Expires">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</Row>
          <Row label="Brief written">
            <span className="tabular-nums">{formatDateTime(c.briefAt)}</span>
            <span className="text-fg-muted"> by {c.createdBy}</span>
          </Row>
        </dl>
      </section>
      <aside className="text-sm">
        <h2 className="text-sm font-semibold [font-stretch:100%]">Next</h2>
        <p className="mt-2 max-w-[48ch] text-fg-muted">
          {c.type === 'solutions'
            ? 'Solutions pages are written from approved Hoverline facts only, so there is no account website to read.'
            : c.facts.length
              ? `${c.facts.filter((f) => f.included).length} sentences from ${a?.domain ?? 'the website'} are ready for the writer.`
              : 'Read the public website for facts the page can quote.'}
        </p>
        {can('marketer') && (
          <Button
            variant="primary"
            className="mt-3"
            onClick={() => api.goTo(c.current ? 'draft' : 'sources')}
          >
            {c.current ? 'Open the draft' : 'Go to sources'}
          </Button>
        )}
      </aside>
    </div>
  )
}
