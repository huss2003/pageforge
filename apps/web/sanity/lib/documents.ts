import { pageSchema, type Page } from '@pageforge/blocks'
import { pageDocumentId } from '../env'

/**
 * Page → Sanity document. Validates with zod first, gives the document a
 * deterministic public id (`page-<slug>`) and stores the slug the way the
 * Studio's slug field expects. Used by the seed script and available to
 * the Factory when it saves drafts (prefix the id with "drafts.").
 */
export function toSanityDocument(page: Page) {
  const parsed = pageSchema.parse(page)
  const { _id: _ignored, slug, ...rest } = parsed
  void _ignored
  return {
    ...rest,
    _id: pageDocumentId(slug),
    _type: 'page' as const,
    slug: { _type: 'slug' as const, current: slug },
  }
}

export type SanityPageDocument = ReturnType<typeof toSanityDocument>
