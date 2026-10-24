/**
 * QA contract (implemented in milestone M4).
 *
 * Checks run in GitHub Actions against a draft preview URL, because Vercel
 * serverless functions cannot host a full Chrome for Lighthouse.
 */
export interface QaThresholds {
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

/** A page must meet these mobile Lighthouse scores (0–100) to be publishable. */
export const defaultThresholds: QaThresholds = {
  performance: 90,
  accessibility: 95,
  seo: 95,
  bestPractices: 95,
}

export interface QaIssue {
  source: 'lighthouse' | 'axe' | 'visual'
  id: string
  message: string
  /** Block the issue was traced to, if any — lets the fixer agent patch content. */
  blockKey?: string
}

export interface QaResult {
  url: string
  scores: QaThresholds
  issues: QaIssue[]
  passed: boolean
}

export function meetsThresholds(scores: QaThresholds, min: QaThresholds = defaultThresholds) {
  return (Object.keys(min) as (keyof QaThresholds)[]).every((k) => scores[k] >= min[k])
}
