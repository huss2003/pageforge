import 'server-only'
import type { SiteType } from '@pageforge/blocks'
import { facts } from '@pageforge/content'
import { getAllPages } from '@/lib/content'
import { pathForPage, sectionIndexes } from '@/lib/paths'

export interface OgContent {
  /** Small line above the headline (section name). */
  section: string
  headline: string
  siteType: SiteType
}

const sectionFor = {
  home: 'Autonomous drone inspection',
  platform: 'Platform',
  page: facts.company.name,
  industry: 'Industries',
  caseStudy: 'Case study',
  landing: facts.company.name,
} as const

/** Maps an OG path ("home", "industries/refineries") to the text it shows. */
export async function resolveOg(segments: string[]): Promise<OgContent | null> {
  const path = segments.join('/') === 'home' ? '/' : `/${segments.join('/')}`
  for (const index of Object.values(sectionIndexes)) {
    if (path === index.path) {
      return {
        section: facts.company.name,
        headline: index.title === 'Industries' ? 'Where Hoverline flies' : 'Case studies',
        siteType: index.title === 'Industries' ? 'substation' : 'open-pit',
      }
    }
  }
  const page = (await getAllPages()).find((p) => pathForPage(p) === path)
  if (!page) return null
  const hero = page.blocks.find((b) => b._type === 'hero')
  return {
    section:
      page.kind === 'caseStudy'
        ? `Case study · ${page.title.split(':')[0]}`
        : sectionFor[page.kind],
    headline: hero?._type === 'hero' ? hero.heading : page.seo.title,
    siteType: hero?._type === 'hero' ? hero.siteType : 'refinery',
  }
}

/** Every OG path to prerender at build time. */
export async function allOgPaths(): Promise<string[][]> {
  const pages = await getAllPages()
  const paths = pages.map((p) =>
    pathForPage(p) === '/' ? ['home'] : pathForPage(p).slice(1).split('/'),
  )
  return [...paths, ...Object.values(sectionIndexes).map((i) => [i.path.slice(1)])]
}
