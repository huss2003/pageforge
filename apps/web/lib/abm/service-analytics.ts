import 'server-only'
import { conversionComparison, engagementSummary, isHot, reviewMetrics } from './analytics'
import { getAbmRuntime } from './runtime'
import type { Campaign, EngagementSummary, Lead, Workspace } from './types'

/** Store-backed analytics for a set of campaigns (one workspace). */
export function analyticsFor(campaigns: Campaign[]) {
  const rt = getAbmRuntime()
  const ids = campaigns.map((c) => c.id)
  return {
    async hotByCampaign(): Promise<Map<string, boolean>> {
      const since = new Date(rt.now().getTime() - 7 * 86_400_000)
      const events = ids.length ? await rt.store.listEvents({ campaignIds: ids, since }) : []
      const out = new Map<string, boolean>()
      for (const id of ids)
        out.set(
          id,
          isHot(
            events.filter((e) => e.campaignId === id),
            rt.now(),
          ),
        )
      return out
    },

    async engagement(id: string): Promise<EngagementSummary> {
      const [events, meetings] = await Promise.all([
        rt.store.listEvents({ campaignIds: [id] }),
        rt.store.listMeetings([id]),
      ])
      return engagementSummary(id, events, meetings, rt.now())
    },

    async overview(workspace: Workspace) {
      const accountIds = campaigns.filter((c) => c.type !== 'solutions').map((c) => c.id)
      const genericIds = campaigns.filter((c) => c.type === 'solutions').map((c) => c.id)
      const [accountEvents, genericEvents] = await Promise.all([
        accountIds.length
          ? rt.store.listEvents({ campaignIds: accountIds, pageKind: 'account' })
          : [],
        // Generic pages without a campaign (static /solutions fallbacks) count in the main workspace.
        genericIds.length || workspace === 'main'
          ? rt.store.listEvents({
              campaignIds: genericIds,
              withoutCampaign: workspace === 'main',
              pageKind: 'generic',
            })
          : [],
      ])
      const currentIds = campaigns.map((c) => c.currentVersionId).filter(Boolean) as string[]
      const claims = await rt.store.listClaimsForVersions(currentIds)
      return {
        comparison: conversionComparison(accountEvents, genericEvents),
        review: reviewMetrics(campaigns, claims),
      }
    },
  }
}

/** Leads of the workspace's campaigns, with the booked meeting slot (if any). */
export async function leadsFor(
  campaigns: Campaign[],
  workspace: Workspace,
): Promise<(Lead & { meetingAt: string | null })[]> {
  const rt = getAbmRuntime()
  const ids = campaigns.map((c) => c.id)
  // Leads from generic pages without a campaign belong to the main workspace.
  const [leads, meetings] = await Promise.all([
    rt.store.listLeads(ids, { withoutCampaign: workspace === 'main' }),
    rt.store.listMeetings(ids),
  ])
  return leads.map((l) => ({
    ...l,
    meetingAt: meetings.find((m) => m.leadId === l.id)?.slotStart ?? null,
  }))
}
