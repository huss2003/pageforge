import type { MetadataRoute } from 'next'
import { listPublicSolutionsPaths } from '@/lib/abm/public'
import { getAllPublicPages } from '@/lib/content'
import { pathForPage, sectionIndexes } from '@/lib/paths'
import { absoluteUrl } from '@/lib/site'

const priority: Record<string, number> = {
  home: 1,
  platform: 0.9,
  industry: 0.8,
  page: 0.7,
  caseStudy: 0.6,
  landing: 0.4,
}

/** Every public page (noindex pages excluded), the section indexes and published /solutions pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, solutions] = await Promise.all([
    getAllPublicPages(),
    listPublicSolutionsPaths().catch(() => [] as string[]),
  ])
  return [
    ...pages.map((page) => ({
      url: absoluteUrl(pathForPage(page)),
      changeFrequency: page.kind === 'home' ? ('weekly' as const) : ('monthly' as const),
      priority: priority[page.kind] ?? 0.5,
    })),
    ...Object.values(sectionIndexes).map((index) => ({
      url: absoluteUrl(index.path),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...solutions.map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
