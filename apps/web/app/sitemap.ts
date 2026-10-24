import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

// M2 replaces this static list with every published page from Sanity.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl, changeFrequency: 'weekly', priority: 1 }]
}
