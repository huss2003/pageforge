import type { Page, PageKind } from '@pageforge/blocks'

/**
 * URL for a page, by kind. Shared by routes, the sitemap, breadcrumbs,
 * Open Graph images and the Studio's Presentation tool.
 * Safe to import from client code (no server-only dependencies).
 */
export function pathForPage(page: Pick<Page, 'kind' | 'slug'>): string {
  return pathFor(page.kind, page.slug)
}

export function pathFor(kind: PageKind, slug: string): string {
  switch (kind) {
    case 'home':
      return '/'
    case 'industry':
      return `/industries/${slug}`
    case 'caseStudy':
      return `/case-studies/${slug}`
    case 'landing':
      return `/lp/${slug}`
    case 'platform':
    case 'page':
      return `/${slug}`
  }
}

/** Section index pages that are built from data rather than stored as pages. */
export const sectionIndexes = {
  industry: { path: '/industries', title: 'Industries' },
  caseStudy: { path: '/case-studies', title: 'Case studies' },
} as const

/** Breadcrumb trail for a page (excluding the page itself). */
export function parentsFor(kind: PageKind): { name: string; path: string }[] {
  const home = { name: 'Home', path: '/' }
  if (kind === 'home') return []
  if (kind === 'industry') return [home, { name: 'Industries', path: '/industries' }]
  if (kind === 'caseStudy') return [home, { name: 'Case studies', path: '/case-studies' }]
  return [home]
}

/** Open Graph image URL for a site path ("/" → "/og/home"). */
export function ogImagePath(path: string): string {
  return path === '/' ? '/og/home' : `/og${path}`
}
