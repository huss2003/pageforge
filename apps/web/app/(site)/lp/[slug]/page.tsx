import type { Metadata } from 'next'
import type { PageKind } from '@pageforge/blocks'
import { PageView } from '@/components/page-view'
import { loadPage, metadataFor, staticParamsFor, type SlugParams } from '@/lib/content/route'

/**
 * Campaign landing pages written by the PageForge Factory (kind "landing").
 * Pages published after the build render on first request and are cached
 * under the `page:<slug>` tag; the Sanity webhook refreshes them on edit.
 * robots: noindex comes from seo.noindex via generateMetadata.
 */
const kinds: PageKind[] = ['landing']

export function generateStaticParams() {
  return staticParamsFor(kinds)
}

export async function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  return metadataFor((await params).slug, kinds)
}

export default async function LandingPage({ params }: SlugParams) {
  const { page, preview } = await loadPage((await params).slug, kinds)
  return <PageView page={page} preview={preview} />
}
