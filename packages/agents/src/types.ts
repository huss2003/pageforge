import type { z } from 'zod'
import type { BlockKind, Page, SiteType } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import type { QaResult } from '@pageforge/qa'

export interface Brief {
  /** Who the page is for, e.g. "Tier-1 refinery operator on the Gulf coast". */
  prospect: string
  siteType: SiteType
  /** Job titles reading the page. */
  audience: string[]
  /** The single outcome the page should drive. */
  goal: 'book-demo' | 'download-report' | 'contact-sales'
  /** Optional context from the sales team, max 600 chars. */
  notes?: string
}

export type RunStatus =
  | 'queued'
  | 'planning'
  | 'writing'
  | 'validating'
  | 'drafted'
  | 'qa-running'
  | 'fixing'
  | 'ready'
  | 'published'
  | 'failed'

export type StepName = 'plan' | 'write' | 'validate' | 'draft' | 'qa' | 'fix' | 'publish'

export interface StepLog {
  step: StepName
  /** Attempt number within the step, starting at 1. */
  attempt: number
  model?: string
  startedAt: string
  durationMs: number
  tokens?: { input: number; output: number }
  ok: boolean
  /** Short human-readable summary shown in the Factory timeline. */
  summary: string
  error?: string
}

/** Output of the planner: an ordered outline before any copy is written. */
export interface PagePlan {
  title: string
  slug: string
  angle: string
  sections: { kind: BlockKind; purpose: string; factIds: string[] }[]
}

export interface LlmResult<T> {
  data: T
  model: string
  tokens?: { input: number; output: number }
}

/**
 * Minimal model interface. Implementations: Gemini (primary), Groq
 * (fallback on 429/5xx), and a deterministic fake for tests and keyless demos.
 */
export interface LlmClient {
  generateJson<T>(opts: {
    system: string
    prompt: string
    schema: z.ZodType<T>
    /** Name used in logs, e.g. "planner". */
    task: string
    temperature?: number
  }): Promise<LlmResult<T>>
}

export interface PipelineDeps {
  llm: LlmClient
  facts: BrandFacts
  /** Persist the page as a CMS draft; returns its id and preview URL. */
  saveDraft(page: Page): Promise<{ id: string; previewUrl: string }>
  /** Called after every step attempt; used for live timeline + Supabase logs. */
  onStep?(log: StepLog, status: RunStatus): void | Promise<void>
  now?: () => Date
}

export interface PipelineResult {
  page: Page
  plan: PagePlan
  draft: { id: string; previewUrl: string }
  steps: StepLog[]
}

/** Signatures implemented in this package (see pipeline.ts / fixer.ts). */
export type RunPipeline = (brief: Brief, deps: PipelineDeps) => Promise<PipelineResult>
export type FixPage = (
  page: Page,
  qa: QaResult,
  deps: Pick<PipelineDeps, 'llm' | 'facts' | 'onStep' | 'now'>,
) => Promise<{ page: Page; steps: StepLog[]; changed: boolean }>
