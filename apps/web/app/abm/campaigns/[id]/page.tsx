import type { Metadata } from 'next'
import { CampaignWorkspace } from '@/components/abm/workspace/campaign-workspace'
import { isStep } from '@/components/abm/workspace/steps'

export const metadata: Metadata = { title: 'Account page' }

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const step = typeof sp.step === 'string' && isStep(sp.step) ? sp.step : null
  return <CampaignWorkspace id={id} initialStep={step} autoGather={sp.gather === '1'} />
}
