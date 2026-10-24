'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { listCampaigns, listLeads, type CampaignRow } from '@/lib/abm/client'
import type { Lead } from '@/lib/abm/types'
import { CrmStatus } from './crm-status'
import { displayPath, formatDateTime } from './format'
import { industryLabels } from './labels'
import { ErrorNote, Skeleton } from './ui'

function campaignName(c: CampaignRow | undefined): string {
  if (!c) return '–'
  return c.accountName ?? `${industryLabels[c.industry]} solutions`
}

/** The built-in CRM: every form submit and booking, newest first. */
export function LeadsView() {
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [campaigns, setCampaigns] = useState<Map<string, CampaignRow>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [l, c] = await Promise.all([listLeads(), listCampaigns()])
      setLeads(l)
      setCampaigns(new Map(c.map((x) => [x.id, x])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load leads.')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const failed = leads?.filter((l) => l.crmStatus === 'failed').length ?? 0

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-xl">Leads</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {leads === null
          ? 'Loading…'
          : `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'} in the built-in CRM.${failed ? ` ${failed} did not sync to HubSpot and ${failed === 1 ? 'is' : 'are'} kept here.` : ''}`}
      </p>

      {error && (
        <ErrorNote className="mt-4" onRetry={load}>
          {error}
        </ErrorNote>
      )}

      {leads === null && !error && (
        <div className="mt-5 border-t border-line" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-6 border-b border-line py-3.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      )}

      {leads && leads.length === 0 && (
        <p className="mt-5 border-y border-dashed border-line py-6 text-sm text-fg-muted">
          No leads yet. They appear here when a visitor fills in the form or books a slot on an
          account page.
        </p>
      )}

      {leads && leads.length > 0 && (
        <>
          <table className="mt-5 hidden w-full border-collapse text-sm lg:table">
            <thead>
              <tr className="text-left text-xs text-fg-muted">
                <th scope="col" className="py-2 pr-4 font-normal">
                  Company
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Contact
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Account page
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  UTM source
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Page
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  CRM
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const c = l.campaignId ? campaigns.get(l.campaignId) : undefined
                return (
                  <tr key={l.id} className="border-t border-line align-baseline">
                    <td className="py-3 pr-4 font-semibold">{l.company}</td>
                    <td className="py-3 pr-4">
                      {l.name}
                      <span className="block text-xs text-fg-muted">
                        {l.role ? `${l.role}, ` : ''}
                        {l.email}
                      </span>
                      {l.message && (
                        <span className="mt-1 block max-w-[40ch] text-xs">
                          &ldquo;{l.message}&rdquo;
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {c ? (
                        <Link
                          href={`/abm/campaigns/${c.id}?step=engagement`}
                          className="underline-offset-4 hover:underline"
                        >
                          {campaignName(c)}
                        </Link>
                      ) : (
                        <span className="text-fg-muted">–</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {l.utm.source ?? <span className="text-fg-muted">Direct</span>}
                    </td>
                    <td className="max-w-0 py-3 pr-4 xl:w-[18%]">
                      <span className="block truncate text-fg-muted" title={l.pageUrl}>
                        {displayPath(l.pageUrl)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <CrmStatus lead={l} />
                    </td>
                    <td className="py-3 text-right whitespace-nowrap text-fg-muted tabular-nums">
                      {formatDateTime(l.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <ul className="mt-5 border-t border-line lg:hidden">
            {leads.map((l) => {
              const c = l.campaignId ? campaigns.get(l.campaignId) : undefined
              return (
                <li key={l.id} className="border-b border-line py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{l.company}</span>
                    <span className="text-xs text-fg-muted tabular-nums">
                      {formatDateTime(l.createdAt)}
                    </span>
                  </div>
                  <p>
                    {l.name} <span className="text-fg-muted">{l.email}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                    <span>{campaignName(c)}</span>
                    <span>{l.utm.source ?? 'Direct'}</span>
                  </p>
                  <div className="mt-1 text-xs">
                    <CrmStatus lead={l} />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </main>
  )
}
