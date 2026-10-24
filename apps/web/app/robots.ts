import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Tools, drafts, one-account pages and the fictional prospect sites stay out of search.
        disallow: [
          '/abm',
          '/demo',
          '/campaign',
          '/fictional',
          '/studio',
          '/api/',
          '/preview',
          '/lp/',
        ],
      },
      {
        // The ABM source fetcher reads the fictional prospect sites (they carry noindex).
        userAgent: 'PageForgeBot',
        allow: '/fictional/',
        disallow: ['/abm', '/demo', '/campaign', '/studio', '/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
