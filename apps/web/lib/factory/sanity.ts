import 'server-only'
import { createClient, type SanityClient } from '@sanity/client'
import type { Page } from '@pageforge/blocks'
import { toSanityDocument } from '@/sanity/lib/documents'
import { pageDocumentId } from '@/sanity/env'
import { getConfig } from './config'

/**
 * Sanity writes for production-mode runs. Demo runs never touch Sanity: they
 * publish to the Factory sandbox (`/factory/p/[slug]`) from the run row.
 *
 * Document ids come from the site's content model (`page-<slug>`; ids with a
 * dot are private in Sanity and would be invisible to the public site).
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

export async function saveSanityDraft(page: Page): Promise<string | null> {
  const c = client()
  if (!c) return null
  const doc = toSanityDocument(page)
  const id = `drafts.${doc._id}`
  await c.createOrReplace({ ...doc, _id: id })
  return id
}

export async function publishSanityPage(page: Page): Promise<string> {
  const c = client()
  if (!c)
    throw new Error(
      'Sanity is not configured: set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN.',
    )
  const doc = toSanityDocument(page)
  await c
    .transaction()
    .createOrReplace(doc)
    .delete(`drafts.${pageDocumentId(page.slug)}`)
    .commit()
  return doc._id
}
