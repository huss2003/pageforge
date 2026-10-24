import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { Block } from '@pageforge/blocks'
import { getSeedPagesByKind } from '@pageforge/content'
import { AccountRoute, accountMetadata, type RouteData } from '@/components/abm/account-route'
import { getSolutionsPage } from '@/lib/abm/public'
import type { Industry } from '@/lib/abm/types'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 300

type Params = { params: Promise<{ industry: string }> }

const industries: Industry[] = ['ports', 'refineries', 'power-grids', 'open-pit-mining', 'solar']

/**
 * The generic industry page: the published solutions campaign when there is
 * one, otherwise the seed industry page with the same slug. Ports and solar
 * have no seed page, so they 404 until a solutions campaign is published.
 */
async function load(industry: string): Promise<RouteData | null> {
  if (!industries.includes(industry as Industry)) return null
  const published = await getSolutionsPage(industry)
  if (published) return published
  const seed = getSeedPagesByKind('industry').find((p) => p.slug === industry)
  if (!seed) return null
  const form = seed.blocks.find(
    (b): b is Extract<Block, { _type: 'demoForm' }> => b._type === 'demoForm',
  )
  const path = `/solutions/${industry}`
  return {
    campaignId: null,
    versionId: null,
    page: seed,
    seo: {
      title: seed.seo.title,
      description: seed.seo.description,
      noindex: false,
      canonicalUrl: absoluteUrl(path),
      ogImageUrl: `/og/industries/${seed.slug}`,
    },
    cta: { kind: 'form', label: form?.submitLabel ?? 'Book a demo', formFields: ['role'] },
    accountName: null,
    type: 'solutions',
    industry: industry as Industry,
    canonicalUrl: absoluteUrl(path),
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).industry)
  if (!data) return { title: 'Page not found', robots: { index: false, follow: false } }
  return accountMetadata(data)
}

export default async function SolutionsPage({ params }: Params) {
  const { industry } = await params
  const data = await load(industry)
  if (!data) notFound()
  // Seed fallbacks have no campaign: events are recorded as generic page views.
  return <AccountRoute data={data} path={`/solutions/${industry}`} />
}
