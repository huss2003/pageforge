import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  AccountRoute,
  GonePage,
  accountMetadata,
  goneMetadata,
} from '@/components/abm/account-route'
import { getAccountPage } from '@/lib/abm/public'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null
  return getAccountPage({ type: 'campaign', slug })
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).slug)
  if (!data) return { title: 'Page not found', robots: { index: false, follow: false } }
  if ('status' in data) return goneMetadata
  return accountMetadata(data)
}

export default async function CampaignPage({ params }: Params) {
  const { slug } = await params
  const data = await load(slug)
  if (!data) notFound()
  if ('status' in data) return <GonePage />
  return <AccountRoute data={data} path={`/campaign/${slug}`} />
}
