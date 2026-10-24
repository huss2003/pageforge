import type { Metadata } from 'next'
import { CampaignList } from '@/components/abm/campaign-list'

export const metadata: Metadata = { title: { absolute: 'Account pages | PageForge ABM' } }

export default function AbmHome() {
  return <CampaignList />
}
