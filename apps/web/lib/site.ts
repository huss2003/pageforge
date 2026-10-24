/** Canonical site URL. Set NEXT_PUBLIC_SITE_URL in Vercel; falls back for local dev. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')

export const site = {
  name: 'Hoverline',
  tagline: 'Autonomous drone inspection for refineries, power grids and mines.',
  description:
    'Hoverline drones fly scheduled routes over industrial sites and flag corrosion, hot spots and slope movement before they turn into incidents.',
  /** Hoverline is fictional; the disclosure is shown on every page. */
  disclosure:
    'Hoverline is a fictional company. This site is a portfolio project built with PageForge.',
} as const
