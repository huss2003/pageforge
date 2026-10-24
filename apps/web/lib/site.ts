import { facts } from '@pageforge/content'
import type { NavItem } from '@pageforge/ui'

/** Canonical site URL. Set NEXT_PUBLIC_SITE_URL in Vercel; falls back for local dev. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')

export const repoUrl = 'https://github.com/huss2003/pageforge'

export const site = {
  name: facts.company.name,
  tagline: 'Autonomous drone inspection for refineries, power grids and mines.',
  description: facts.company.oneLiner,
  /** Hoverline is fictional; the disclosure is shown on every page. */
  disclosure: facts.company.disclosure,
} as const

export const mainNav: NavItem[] = [
  { label: 'Platform', href: '/platform' },
  { label: 'Industries', href: '/industries' },
  { label: 'Case studies', href: '/case-studies' },
]

export const navCta: NavItem = { label: 'Book a demo', href: '/book-a-demo' }

export const footerNav: NavItem[] = [
  ...mainNav,
  navCta,
  { label: 'Factory', href: '/factory' },
  { label: 'GitHub', href: repoUrl },
]

export function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${siteUrl}${path === '/' ? '' : path}` || siteUrl
}
