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

type Params = { params: Promise<{ slugToken: string }> }

/** Private demo page: /demo/[slug]-[12-char token]. Wrong token → 404, no oracle. */
async function load(slugToken: string) {
  if (!/^[a-z0-9-]{14,120}$/.test(slugToken)) return null
  return getAccountPage({ type: 'demo', slugToken })
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).slugToken)
  if (!data) return { title: 'Page not found', robots: { index: false, follow: false } }
  if ('status' in data) return goneMetadata
  return accountMetadata(data, { forceNoindex: true })
}

export default async function DemoPage({ params }: Params) {
  const { slugToken } = await params
  const data = await load(slugToken)
  if (!data) notFound()
  if ('status' in data) return <GonePage />
  // The token stays out of analytics paths.
  const slug = slugToken.slice(0, Math.max(0, slugToken.length - 13))
  return <AccountRoute data={data} path={`/demo/${slug}`} />
}
