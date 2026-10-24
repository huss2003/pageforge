import { createClient, type SanityClient, type StegaConfig } from 'next-sanity'
import { apiVersion, dataset, isSanityConfigured, projectId, studioBasePath } from '../env'

/**
 * Published-content client for the public site. Returns null when Sanity is
 * not configured, so callers fall back to seed content instead of throwing.
 */
export const client: SanityClient | null = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      perspective: 'published',
      stega: false,
    })
  : null

/**
 * Stega encodes copy so the Presentation tool can map rendered text back to
 * its field. Enum-like fields are excluded: the renderer switches on them,
 * and an encoded "refinery" would no longer match.
 */
const nonCopyFields = new Set(['kind', 'siteType', 'variant', 'href', 'slug', 'runId', 'model'])
const stega: StegaConfig = {
  enabled: true,
  studioUrl: studioBasePath,
  filter: (props) =>
    props.filterDefault(props) &&
    !props.sourcePath.some((segment) => typeof segment === 'string' && nonCopyFields.has(segment)),
}

/** Client for draft previews; requires a Viewer token on the server. */
export function previewClient(): SanityClient | null {
  const token = process.env.SANITY_API_READ_TOKEN
  if (!client || !token) return null
  return client.withConfig({
    token,
    useCdn: false,
    perspective: 'drafts',
    stega,
  })
}
