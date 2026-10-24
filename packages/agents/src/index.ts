/**
 * Agent pipeline contract (implemented in milestone M3).
 *
 *   brief → planner → writer → validator → Sanity draft → QA → fixer → publish
 *
 * Each step is a pure-ish function with typed input/output so runs can be
 * logged step by step to Supabase and replayed when debugging.
 */
export interface Brief {
  /** Who the page is for, e.g. "Tier-1 refinery operator". */
  prospect: string
  industry: 'oil-and-gas' | 'utilities' | 'mining' | 'other'
  /** Job titles reading the page. */
  audience: string[]
  /** The single outcome the page should drive. */
  goal: 'book-demo' | 'download-report' | 'contact-sales'
  /** Optional extra context from the sales team. */
  notes?: string
}

export type RunStatus =
  | 'planning'
  | 'writing'
  | 'validating'
  | 'drafted'
  | 'qa-running'
  | 'fixing'
  | 'ready'
  | 'published'
  | 'failed'

export interface StepLog {
  step: 'plan' | 'write' | 'validate' | 'draft' | 'qa' | 'fix' | 'publish'
  model?: string
  startedAt: string
  durationMs: number
  tokens?: { input: number; output: number }
  ok: boolean
  error?: string
}
