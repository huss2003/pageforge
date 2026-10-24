/**
 * QA contract (implemented in milestone M4).
 *
 * Checks run in GitHub Actions against a draft preview URL, because Vercel
 * serverless functions cannot host a full Chrome for Lighthouse.
 *
 * This entry is types + pure helpers only, safe for the web bundle.
 * The CLI lives in `src/run.ts`; the GitHub dispatcher in `@pageforge/qa/dispatch`.
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

/** What the CLI writes to `result.json`: a QaResult plus run metadata. */
export interface QaRunOutput extends QaResult {
  runId?: string
  attempt?: number
  startedAt: string
  durationMs: number
  /** Local path of the full-page screenshot (uploaded as a workflow artifact). */
  screenshotPath?: string
  /** axe violations by impact, for the dashboard. */
  axeCounts?: Partial<Record<'critical' | 'serious' | 'moderate' | 'minor', number>>
  lighthouseVersion?: string
  /** Set when the run itself crashed (scores are then 0 and passed is false). */
  error?: string
}

/**
 * JSON body POSTed to the callback URL by the QA workflow, with header
 * `x-qa-secret: <QA_CALLBACK_SECRET>`. Maps onto `pf_qa_results`.
 */
export interface QaCallbackPayload extends QaRunOutput {
  runId: string
  attempt: number
  /** e.g. https://github.com/huss2003/pageforge/actions/runs/123 */
  workflowRunUrl?: string
  /** Workflow artifact (screenshot + result.json) download page. */
  screenshotUrl?: string
}

/** Header carrying the shared secret on QA callbacks. */
export const QA_SECRET_HEADER = 'x-qa-secret'

/** Constant-time comparison for the callback secret (no Node crypto needed). */
export function isValidQaSecret(
  received: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!received || !expected) return false
  const a = new TextEncoder().encode(received)
  const b = new TextEncoder().encode(expected)
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

/** axe impacts that block publishing. */
export const BLOCKING_AXE_IMPACTS = ['serious', 'critical'] as const

/**
 * passed = scores meet thresholds AND no serious/critical axe violations.
 * `axeImpacts` lists the impact of each axe violation found.
 */
export function computePassed(
  scores: QaThresholds,
  axeImpacts: (string | null | undefined)[],
  min: QaThresholds = defaultThresholds,
): boolean {
  return (
    meetsThresholds(scores, min) &&
    !axeImpacts.some((i) => (BLOCKING_AXE_IMPACTS as readonly string[]).includes(i ?? ''))
  )
}

/** Type guard for callback bodies received by the web app. */
export function isQaCallbackPayload(v: unknown): v is QaCallbackPayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  const s = o.scores as Record<string, unknown> | undefined
  return (
    typeof o.runId === 'string' &&
    typeof o.attempt === 'number' &&
    typeof o.url === 'string' &&
    typeof o.passed === 'boolean' &&
    Array.isArray(o.issues) &&
    !!s &&
    ['performance', 'accessibility', 'seo', 'bestPractices'].every((k) => typeof s[k] === 'number')
  )
}
