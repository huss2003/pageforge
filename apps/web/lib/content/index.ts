import 'server-only'
import { pageSchema, type Page, type PageKind } from '@pageforge/blocks'
import { getSeedPage, getSeedPagesByKind, seedPages } from '@pageforge/content'
import { stegaClean } from 'next-sanity'
import { client, previewClient } from '@/sanity/lib/client'
import { ALL_PAGES_QUERY, PAGES_BY_KIND_QUERY, PAGE_QUERY } from '@/sanity/lib/queries'
import { safeErrorMessage } from '@/lib/env'

/**
 * Content layer for the public site.
 *
 * Source of truth is Sanity when NEXT_PUBLIC_SANITY_PROJECT_ID is set,
 * otherwise the seed pages in @pageforge/content. Every CMS document is
 * validated with the same zod `pageSchema` the AI writer must satisfy;
 * invalid or missing documents fall back to the seed version, so a broken
 * edit can never render a broken page.
 *
 * Cache tags: `page:<slug>` per page and `pages` for any listing. The
 * Sanity webhook (app/api/revalidate) expires them on publish.
 */

export const tags = {
  pages: 'pages',
  page: (slug: string) => `page:${slug}`,
} as const

/** Pages are cached until a publish webhook revalidates them. */
const REVALIDATE_SECONDS = 60 * 60 * 24

export interface GetPageOptions {
  /** Read drafts (draft mode). Requires SANITY_API_READ_TOKEN. */
  preview?: boolean
}

function parsePage(raw: unknown, source: string): Page | null {
  if (!raw) return null
  const result = pageSchema.safeParse(raw)
  if (result.success) return result.data
  console.error(
    `[content] ${source} failed validation; using seed content instead.`,
    result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
  )
  return null
}

/**
 * Draft previews carry stega-encoded strings (invisible markers that let
 * the Presentation tool map text back to fields). Validate the clean copy,
 * then put the encoded strings back wherever the text is unchanged, so the
 * rendered page keeps zod defaults and trimming but stays click-to-edit.
 */
function restoreStega(parsed: unknown, raw: unknown): unknown {
  if (typeof parsed === 'string') {
    return typeof raw === 'string' && stegaClean(raw).trim() === parsed ? raw : parsed
  }
  if (Array.isArray(parsed)) {
    return parsed.map((v, i) => restoreStega(v, Array.isArray(raw) ? raw[i] : undefined))
  }
  if (parsed && typeof parsed === 'object') {
    const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, restoreStega(v, source[k])]),
    )
  }
  return parsed
}

async function fetchCms<T>(
  query: string,
  params: Record<string, string>,
  opts: { preview?: boolean; tags: string[] },
): Promise<T | null> {
  const preview = Boolean(opts.preview)
  const sanity = preview ? previewClient() : client
  if (!sanity) return null
  try {
    return await sanity.fetch<T>(query, params, {
      ...(preview
        ? { cache: 'no-store' as const }
        : { next: { revalidate: REVALIDATE_SECONDS, tags: opts.tags } }),
    })
  } catch (error) {
    const message = safeErrorMessage(error)
    console.error(`[content] Sanity request failed; using seed content instead. ${message}`)
    return null
  }
}

/** One page by slug. Falls back to the seed page with the same slug. */
export async function getPage(slug: string, options: GetPageOptions = {}): Promise<Page | null> {
  const preview = Boolean(options.preview)
  const raw = await fetchCms<unknown>(
    PAGE_QUERY,
    { slug },
    { preview, tags: [tags.page(slug), tags.pages] },
  )
  if (raw && preview) {
    const valid = parsePage(stegaClean(raw), `draft "${slug}"`)
    return valid ? (restoreStega(valid, raw) as Page) : (getSeedPage(slug) ?? null)
  }
  return parsePage(raw, `page "${slug}"`) ?? getSeedPage(slug) ?? null
}

/** Merge CMS pages with seed pages: CMS wins per slug, seed fills gaps. */
function mergeWithSeed(cms: unknown[] | null, seed: Page[], label: string): Page[] {
  const bySlug = new Map<string, Page>(seed.map((p) => [p.slug, p]))
  for (const raw of cms ?? []) {
    const slug = (raw as { slug?: unknown })?.slug
    const page = parsePage(raw, `${label} "${String(slug)}"`)
    if (page) bySlug.set(page.slug, page)
  }
  return [...bySlug.values()]
}

/** All pages of one kind (e.g. every industry page). */
export async function getPagesByKind(kind: PageKind): Promise<Page[]> {
  const cms = await fetchCms<unknown[]>(PAGES_BY_KIND_QUERY, { kind }, { tags: [tags.pages] })
  return mergeWithSeed(cms, getSeedPagesByKind(kind), kind).filter((p) => p.kind === kind)
}

/** Every page, including noindex ones (used for static params). */
export async function getAllPages(): Promise<Page[]> {
  const cms = await fetchCms<unknown[]>(ALL_PAGES_QUERY, {}, { tags: [tags.pages] })
  return mergeWithSeed(cms, seedPages, 'page')
}

/** Pages that belong in the sitemap: everything not marked noindex. */
export async function getAllPublicPages(): Promise<Page[]> {
  return (await getAllPages()).filter((p) => !p.seo.noindex)
}
