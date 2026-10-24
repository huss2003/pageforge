import 'server-only'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Page, PageKind } from '@pageforge/blocks'
import { pageMetadata } from '@/lib/seo'
import { getAllPages, getPage } from './index'

/**
 * Shared loaders for page routes. Each route accepts only certain page
 * kinds, so /industries/<case-study-slug> is a 404, not a duplicate.
 */
export type SlugParams = { params: Promise<{ slug: string }> }

export async function staticParamsFor(kinds: PageKind[]): Promise<{ slug: string }[]> {
  const pages = await getAllPages()
  return pages.filter((p) => kinds.includes(p.kind)).map((p) => ({ slug: p.slug }))
}

export async function metadataFor(slug: string, kinds: PageKind[]): Promise<Metadata> {
  const page = await getPage(slug)
  if (!page || !kinds.includes(page.kind)) return {}
  return pageMetadata(page)
}

/** Loads a page for rendering, reading drafts when draft mode is on. */
export async function loadPage(
  slug: string,
  kinds: PageKind[],
): Promise<{ page: Page; preview: boolean }> {
  const { isEnabled: preview } = await draftMode()
  const page = await getPage(slug, { preview })
  if (!page || !kinds.includes(page.kind)) notFound()
  return { page, preview }
}
