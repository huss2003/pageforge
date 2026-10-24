import type { Metadata } from 'next'
import type { PageKind } from '@pageforge/blocks'
import { PageView } from '@/components/page-view'
import { loadPage, metadataFor, staticParamsFor, type SlugParams } from '@/lib/content/route'

const kinds: PageKind[] = ['caseStudy']

export function generateStaticParams() {
  return staticParamsFor(kinds)
}

export async function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  return metadataFor((await params).slug, kinds)
}

export default async function CaseStudyPage({ params }: SlugParams) {
  const { page, preview } = await loadPage((await params).slug, kinds)
  return <PageView page={page} preview={preview} />
}
