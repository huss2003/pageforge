import type { Page } from '@pageforge/blocks'
import type { QaIssue, QaThresholds } from '@pageforge/qa'
import type { Brief, PagePlan, RunStatus, StepLog } from './engine'

export type RunMode = 'demo' | 'production'

/** One text change the fixer made, shown as before/after in the QA panel. */
export interface FixChange {
  blockKey: string | null
  blockType: string | null
  /** Dotted path inside the block, e.g. "secondaryCta.label". */
  field: string
  before: string
  after: string
}

export interface FixRecord {
  /** The QA attempt whose issues this fix answered. */
  attempt: number
  at: string
  changes: FixChange[]
}

export interface QaRecord {
  attempt: number
  createdAt: string
  url: string
  scores: QaThresholds
  issues: QaIssue[]
  passed: boolean
  simulated: boolean
  screenshotUrl?: string | null
  workflowRunUrl?: string | null
}

export interface RunRecord {
  id: string
  createdAt: string
  updatedAt: string
  mode: RunMode
  status: RunStatus
  brief: Brief
  plan: PagePlan | null
  page: Page | null
  slug: string | null
  draftId: string | null
  previewUrl: string | null
  qaAttempts: number
  /** Latest QA result, or null before the first one arrives. */
  lastQa: QaRecord | null
  fixes: FixRecord[]
  error: string | null
  model: string | null
  simulated: boolean
  ipHash: string | null
  startedAt: string | null
  readyAt: string | null
  publishedAt: string | null
  timeToShipMs: number | null
}

/** A run as sent to the browser: never includes the IP hash. */
export type PublicRun = Omit<RunRecord, 'ipHash'>

export interface StoredStep extends StepLog {
  id: number
}

/** GET /api/factory/runs/[id] response. */
export interface RunPayload {
  run: PublicRun
  steps: StoredStep[]
  qa: QaRecord[]
  liveUrl: string | null
}

export interface NewRun {
  mode: RunMode
  brief: Brief
  simulated: boolean
  ipHash: string | null
}

export type RunPatch = Partial<
  Omit<RunRecord, 'id' | 'createdAt' | 'updatedAt' | 'brief' | 'ipHash' | 'mode'>
>

export interface RunExpectation {
  status: RunStatus | RunStatus[]
  qaAttempts?: number
}

export interface RunSummary {
  id: string
  createdAt: string
  mode: RunMode
  status: RunStatus
  prospect: string
  siteType: Brief['siteType']
  slug: string | null
  model: string | null
  simulated: boolean
  qaAttempts: number
  qaPassed: boolean | null
  firstQaPassed: boolean | null
  fixes: number
  timeToShipMs: number | null
}

/**
 * Persistence for Factory runs. Two implementations: Supabase (shared, durable)
 * and in-memory (per server instance; used when Supabase is not configured).
 */
export interface FactoryStore {
  readonly kind: 'supabase' | 'memory'
  createRun(input: NewRun): Promise<RunRecord>
  getRun(id: string): Promise<RunRecord | null>
  updateRun(id: string, patch: RunPatch): Promise<RunRecord>
  /**
   * Atomically apply `patch` only if the run still matches `expect`.
   * Returns null when another request got there first — the basis of
   * idempotent QA callbacks and publishing.
   */
  claimRun(id: string, expect: RunExpectation, patch: RunPatch): Promise<RunRecord | null>
  findPublished(mode: RunMode, slug: string): Promise<RunRecord | null>
  appendStep(runId: string, step: StepLog): Promise<void>
  listSteps(runId: string): Promise<StoredStep[]>
  /** Returns false when a result for (runId, attempt) already exists. */
  addQaResult(runId: string, result: QaRecord): Promise<boolean>
  listQaResults(runId: string): Promise<QaRecord[]>
  listRecentRuns(limit: number): Promise<RunSummary[]>
  countRunsSince(since: Date): Promise<number>
  /** Increment the counter for `key` today; true while within `limit`. */
  hitRateLimit(key: string, limit: number): Promise<boolean>
  /** Current count for `key` today without incrementing. */
  peekRateLimit(key: string): Promise<number>
}

export function toPublicRun(run: RunRecord): PublicRun {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ipHash, ...rest } = run
  return rest
}

export function summarize(run: RunRecord, firstQa: QaRecord | undefined): RunSummary {
  return {
    id: run.id,
    createdAt: run.createdAt,
    mode: run.mode,
    status: run.status,
    prospect: run.brief.prospect,
    siteType: run.brief.siteType,
    slug: run.slug,
    model: run.model,
    simulated: run.simulated,
    qaAttempts: run.qaAttempts,
    qaPassed: run.lastQa ? run.lastQa.passed : null,
    firstQaPassed: firstQa ? firstQa.passed : null,
    fixes: run.fixes.length,
    timeToShipMs: run.timeToShipMs,
  }
}

export const terminalStatuses: RunStatus[] = ['ready', 'published', 'failed']
