import { defineQuery } from 'next-sanity'

/**
 * GROQ for pages. The projection flattens `slug.current` and keeps every
 * other field as stored, because the Studio schema mirrors the zod
 * `pageSchema` field for field. Results are validated before rendering.
 */
const pageFields = /* groq */ `
  _id,
  _updatedAt,
  kind,
  title,
  "slug": slug.current,
  seo,
  blocks,
  generatedBy
`

export const PAGE_QUERY = defineQuery(
  `*[_type == "page" && slug.current == $slug] | order(_updatedAt desc)[0]{${pageFields}}`,
)

export const PAGES_BY_KIND_QUERY = defineQuery(
  `*[_type == "page" && kind == $kind && defined(slug.current)] | order(title asc){${pageFields}}`,
)

export const ALL_PAGES_QUERY = defineQuery(
  `*[_type == "page" && defined(slug.current)] | order(kind asc, title asc){${pageFields}}`,
)
