/**
 * Sanity configuration from environment variables.
 * Every value is optional: without a project id the site serves the seed
 * pages from @pageforge/content and /studio shows setup instructions.
 */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim() || ''
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || 'production'
/** Dataset the public Factory demo publishes into (see .env.example). */
export const demoDataset = process.env.SANITY_DEMO_DATASET?.trim() || 'demo'
/** Pin the API version so query behaviour never changes under us. */
export const apiVersion = '2025-10-01'
export const studioBasePath = '/studio'

export const isSanityConfigured = projectId.length > 0

/**
 * Deterministic document id for a page. Ids with a "." are private in
 * Sanity (readable only with a token), so pages use "page-<slug>" to stay
 * readable by the tokenless public site.
 */
export function pageDocumentId(slug: string): string {
  return `page-${slug}`
}
