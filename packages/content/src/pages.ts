import type { Page } from '@pageforge/blocks'

// PLACEHOLDER — the site/content builder replaces this with every seed page.
export const seedPages: Page[] = []

export function getSeedPage(slug: string): Page | undefined {
  return seedPages.find((p) => p.slug === slug)
}
