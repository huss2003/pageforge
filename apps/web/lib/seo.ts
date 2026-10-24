import type { Metadata } from 'next'
import type { Block, Page } from '@pageforge/blocks'
import { facts } from '@pageforge/content'
import type {
  Article,
  BreadcrumbList,
  FAQPage,
  Graph,
  Organization,
  Thing,
  WebPage,
  WebSite,
} from 'schema-dts'
import { ogImagePath, parentsFor, pathForPage } from './paths'
import { absoluteUrl, repoUrl, site, siteUrl } from './site'

const OG_SIZE = { width: 1200, height: 630 }

interface MetadataInput {
  path: string
  title: string
  description: string
  noindex?: boolean
  /** Use the title as-is instead of the "%s | Hoverline" template. */
  absoluteTitle?: boolean
  type?: 'website' | 'article'
}

/** Metadata for any site path: canonical, robots, Open Graph and Twitter. */
export function buildMetadata(input: MetadataInput): Metadata {
  const fullTitle = input.absoluteTitle ? input.title : `${input.title} | ${site.name}`
  const image = { url: ogImagePath(input.path), ...OG_SIZE, alt: input.title }
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    robots: input.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: input.type ?? 'website',
      url: input.path,
      siteName: site.name,
      title: fullTitle,
      description: input.description,
      locale: 'en_US',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: input.description,
      images: [image.url],
    },
  }
}

export function pageMetadata(page: Page): Metadata {
  const isHome = page.kind === 'home'
  return buildMetadata({
    path: pathForPage(page),
    title: isHome ? `${site.name}: ${page.seo.title}` : page.seo.title,
    description: page.seo.description,
    noindex: page.seo.noindex,
    absoluteTitle: isHome,
    type: page.kind === 'caseStudy' ? 'article' : 'website',
  })
}

// ---------------------------------------------------------------- JSON-LD

const ids = {
  organization: `${siteUrl}/#organization`,
  website: `${siteUrl}/#website`,
  page: (path: string) => `${absoluteUrl(path)}#webpage`,
  breadcrumb: (path: string) => `${absoluteUrl(path)}#breadcrumb`,
}

export function organizationLd(): Organization {
  return {
    '@type': 'Organization',
    '@id': ids.organization,
    name: site.name,
    url: siteUrl,
    logo: absoluteUrl('/icon.svg'),
    description: `${facts.company.oneLiner} ${facts.company.disclosure}`,
    sameAs: [repoUrl],
  }
}

export function websiteLd(): WebSite {
  return {
    '@type': 'WebSite',
    '@id': ids.website,
    url: siteUrl,
    name: site.name,
    description: site.description,
    inLanguage: 'en',
    publisher: { '@id': ids.organization },
  }
}

export function breadcrumbLd(
  path: string,
  name: string,
  parents: { name: string; path: string }[],
): BreadcrumbList {
  const trail = [...parents, { name, path }]
  return {
    '@type': 'BreadcrumbList',
    '@id': ids.breadcrumb(path),
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function webPageLd(opts: {
  path: string
  name: string
  description: string
  type?: 'WebPage' | 'CollectionPage'
}): WebPage {
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': ids.page(opts.path),
    url: absoluteUrl(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: 'en',
    isPartOf: { '@id': ids.website },
    about: { '@id': ids.organization },
    breadcrumb: { '@id': ids.breadcrumb(opts.path) },
    primaryImageOfPage: { '@type': 'ImageObject', url: absoluteUrl(ogImagePath(opts.path)) },
  } as WebPage
}

function faqLd(path: string, block: Extract<Block, { _type: 'faq' }>): FAQPage {
  return {
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(path)}#faq`,
    mainEntity: block.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

function caseStudyLd(path: string, page: Page): Article | null {
  const block = page.blocks.find(
    (b): b is Extract<Block, { _type: 'caseStudy' }> => b._type === 'caseStudy',
  )
  if (!block) return null
  return {
    '@type': 'Article',
    '@id': `${absoluteUrl(path)}#article`,
    headline: block.heading.slice(0, 110),
    description: page.seo.description,
    articleSection: 'Case studies',
    about: { '@type': 'Organization', name: block.operator },
    author: { '@id': ids.organization },
    publisher: { '@id': ids.organization },
    mainEntityOfPage: { '@id': ids.page(path) },
    image: absoluteUrl(ogImagePath(path)),
  }
}

/** Full JSON-LD graph for a CMS or seed page. */
export function pageJsonLd(page: Page): Graph {
  const path = pathForPage(page)
  const nodes: Thing[] = []
  if (page.kind === 'home') nodes.push(organizationLd(), websiteLd())
  nodes.push(
    webPageLd({ path, name: page.seo.title, description: page.seo.description }),
    breadcrumbLd(path, page.kind === 'home' ? 'Home' : page.title, parentsFor(page.kind)),
  )
  const faq = page.blocks.find((b): b is Extract<Block, { _type: 'faq' }> => b._type === 'faq')
  if (faq) nodes.push(faqLd(path, faq))
  if (page.kind === 'caseStudy') {
    const article = caseStudyLd(path, page)
    if (article) nodes.push(article)
  }
  return { '@context': 'https://schema.org', '@graph': nodes }
}

/** JSON-LD for section index pages built from data. */
export function indexJsonLd(opts: {
  path: string
  name: string
  description: string
  items: { name: string; path: string }[]
}): Graph {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      webPageLd({ ...opts, type: 'CollectionPage' }),
      breadcrumbLd(opts.path, opts.name, [{ name: 'Home', path: '/' }]),
      {
        '@type': 'ItemList',
        '@id': `${absoluteUrl(opts.path)}#list`,
        itemListElement: opts.items.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          url: absoluteUrl(item.path),
        })),
      },
    ],
  }
}
