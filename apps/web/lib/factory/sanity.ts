import 'server-only'
import { createClient, type SanityClient } from '@sanity/client'
import type { Page } from '@pageforge/blocks'
import { getConfig } from './config'

/**
 * Sanity writes for production-mode runs. Demo runs never touch Sanity: they
 * publish to the Factory sandbox (`/factory/p/[slug]`) from the run row.
 */
const API_VERSION = '2025-10-01'

function client(): SanityClient | null {
  const s = getConfig().sanity
  if (!s) return null
  return createClient({
    projectId: s.projectId,
    dataset: s.dataset,
    apiVersion: API_VERSION,
    token: s.writeToken,
    useCdn: false,
    perspective: 'raw',
  })
}

export function sanityWriteEnabled(): boolean {
  return getConfig().sanity !== null
}

/** Map a block-schema page onto the Sanity `page` document. */
export function toSanityDoc(page: Page, id: string) {
  return {
    _id: id,
    _type: 'page' as const,
    kind: page.kind,
    title: page.title,
    slug: { _type: 'slug' as const, current: page.slug },
    seo: page.seo,
    blocks: page.blocks,
    ...(page.generatedBy ? { generatedBy: page.generatedBy } : {}),
  }
}

export async function saveSanityDraft(page: Page): Promise<string | null> {
  const c = client()
  if (!c) return null
  const id = `drafts.page.${page.slug}`
  await c.createOrReplace(toSanityDoc(page, id))
  return id
}

export async function publishSanityPage(page: Page): Promise<string> {
  const c = client()
  if (!c)
    throw new Error(
      'Sanity is not configured: set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN.',
    )
  const id = `page.${page.slug}`
  await c
    .transaction()
    .createOrReplace(toSanityDoc(page, id))
    .delete(`drafts.page.${page.slug}`)
    .commit()
  return id
}
