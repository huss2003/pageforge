import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Page } from '@pageforge/blocks'
import type { Brief, PagePlan, RunStatus, StepLog, StepName } from '@/lib/factory/engine'
import {
  summarize,
  type FactoryStore,
  type FixRecord,
  type QaRecord,
  type RunMode,
  type RunPatch,
  type RunRecord,
  type StoredStep,
} from '@/lib/factory/types'
import { redactSecrets } from '@/lib/env'

/**
 * Supabase implementation of FactoryStore over the tables in
 * supabase/migrations/0001_pageforge.sql.
 *
 * The schema has no column for fixer change logs, so `last_qa` holds
 * `{ qa, fixes }` and this module maps it back to `lastQa` + `fixes`.
 */
interface RunRow {
  id: string
  created_at: string
  updated_at: string
  mode: RunMode
  status: RunStatus
  brief: Brief
  plan: PagePlan | null
  page: Page | null
  slug: string | null
  draft_id: string | null
  preview_url: string | null
  qa_attempts: number
  last_qa: { qa: QaRecord | null; fixes: FixRecord[] } | null
  error: string | null
  model: string | null
  simulated: boolean
  ip_hash: string | null
  started_at: string | null
  ready_at: string | null
  published_at: string | null
  time_to_ship_ms: number | null
}

interface StepRow {
  id: number
  run_id: string
  step: StepName
  attempt: number
  model: string | null
  started_at: string
  duration_ms: number
  tokens_in: number | null
  tokens_out: number | null
  ok: boolean
  summary: string
  error: string | null
}

interface QaRow {
  run_id: string
  created_at: string
  attempt: number
  url: string
  scores: QaRecord['scores']
  issues: QaRecord['issues']
  passed: boolean
  screenshot_url: string | null
  workflow_run_url: string | null
}

const fromRow = (r: RunRow): RunRecord => ({
  id: r.id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  mode: r.mode,
  status: r.status,
  brief: r.brief,
  plan: r.plan,
  page: r.page,
  slug: r.slug,
  draftId: r.draft_id,
  previewUrl: r.preview_url,
  qaAttempts: r.qa_attempts,
  lastQa: r.last_qa?.qa ?? null,
  fixes: r.last_qa?.fixes ?? [],
  error: r.error,
  model: r.model,
  simulated: r.simulated,
  ipHash: r.ip_hash,
  startedAt: r.started_at,
  readyAt: r.ready_at,
  publishedAt: r.published_at,
  timeToShipMs: r.time_to_ship_ms,
})

function toRow(patch: RunPatch, current?: RunRecord): Partial<RunRow> {
  const row: Partial<RunRow> = {}
  const set = <K extends keyof RunRow>(k: K, v: RunRow[K] | undefined) => {
    if (v !== undefined) row[k] = v
  }
  set('status', patch.status)
  set('plan', patch.plan)
  set('page', patch.page)
  set('slug', patch.slug)
  set('draft_id', patch.draftId)
  set('preview_url', patch.previewUrl)
  set('qa_attempts', patch.qaAttempts)
  set('error', patch.error)
  set('model', patch.model)
  set('simulated', patch.simulated)
  set('started_at', patch.startedAt)
  set('ready_at', patch.readyAt)
  set('published_at', patch.publishedAt)
  set('time_to_ship_ms', patch.timeToShipMs)
  if (patch.lastQa !== undefined || patch.fixes !== undefined) {
    row.last_qa = {
      qa: patch.lastQa !== undefined ? patch.lastQa : (current?.lastQa ?? null),
      fixes: patch.fixes !== undefined ? patch.fixes : (current?.fixes ?? []),
    }
  }
  return row
}

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`Supabase ${what} failed: ${redactSecrets(error.message)}`)
}

/**
 * The schema has no `simulated` column on pf_qa_results. Live results always
 * carry the GitHub Actions run URL; simulated ones never do.
 */
const qaFromRow = (r: QaRow): QaRecord => ({
  attempt: r.attempt,
  createdAt: r.created_at,
  url: r.url,
  scores: r.scores,
  issues: r.issues,
  passed: r.passed,
  simulated: !r.workflow_run_url,
  screenshotUrl: r.screenshot_url,
  workflowRunUrl: r.workflow_run_url,
})

export function createSupabaseStore(db: SupabaseClient): FactoryStore {
  const runs = () => db.from('pf_runs')

  async function getRun(id: string) {
    const { data, error } = await runs().select('*').eq('id', id).maybeSingle<RunRow>()
    // An invalid uuid is "not found", not a server error.
    if (error && /invalid input syntax for type uuid/i.test(error.message)) return null
    fail('getRun', error)
    return data ? fromRow(data) : null
  }

  return {
    kind: 'supabase',

    async createRun(input) {
      const { data, error } = await runs()
        .insert({
          mode: input.mode,
          brief: input.brief,
          simulated: input.simulated,
          ip_hash: input.ipHash,
          last_qa: { qa: null, fixes: [] },
        })
        .select('*')
        .single<RunRow>()
      fail('createRun', error)
      return fromRow(data!)
    },

    getRun,

    async updateRun(id, patch) {
      const current =
        patch.lastQa !== undefined || patch.fixes !== undefined ? await getRun(id) : null
      const { data, error } = await runs()
        .update(toRow(patch, current ?? undefined))
        .eq('id', id)
        .select('*')
        .single<RunRow>()
      fail('updateRun', error)
      return fromRow(data!)
    },

    async claimRun(id, expect, patch) {
      const current = await getRun(id)
      if (!current) return null
      // The WHERE clause makes this a compare-and-set: concurrent callers race on one row update.
      let q = runs()
        .update(toRow(patch, current))
        .eq('id', id)
        .in('status', Array.isArray(expect.status) ? expect.status : [expect.status])
      if (expect.qaAttempts !== undefined) q = q.eq('qa_attempts', expect.qaAttempts)
      const { data, error } = await q.select('*').maybeSingle<RunRow>()
      fail('claimRun', error)
      return data ? fromRow(data) : null
    },

    async findPublished(mode, slug) {
      const { data, error } = await runs()
        .select('*')
        .eq('mode', mode)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle<RunRow>()
      fail('findPublished', error)
      return data ? fromRow(data) : null
    },

    async appendStep(runId: string, s: StepLog) {
      const { error } = await db.from('pf_run_steps').insert({
        run_id: runId,
        step: s.step,
        attempt: s.attempt,
        model: s.model ?? null,
        started_at: s.startedAt,
        duration_ms: Math.max(0, Math.round(s.durationMs)),
        tokens_in: s.tokens?.input ?? null,
        tokens_out: s.tokens?.output ?? null,
        ok: s.ok,
        summary: s.summary.slice(0, 500),
        error: s.error?.slice(0, 1000) ?? null,
      })
      fail('appendStep', error)
    },

    async listSteps(runId) {
      const { data, error } = await db
        .from('pf_run_steps')
        .select('*')
        .eq('run_id', runId)
        .order('id', { ascending: true })
        .returns<StepRow[]>()
      fail('listSteps', error)
      return (data ?? []).map((r): StoredStep => ({
        id: r.id,
        step: r.step,
        attempt: r.attempt,
        model: r.model ?? undefined,
        startedAt: r.started_at,
        durationMs: r.duration_ms,
        tokens:
          r.tokens_in != null && r.tokens_out != null
            ? { input: r.tokens_in, output: r.tokens_out }
            : undefined,
        ok: r.ok,
        summary: r.summary,
        error: r.error ?? undefined,
      }))
    },

    async addQaResult(runId, q) {
      // Callers claim the run first (see handleQaResult), so this check is a backstop.
      const existing = await db
        .from('pf_qa_results')
        .select('id')
        .eq('run_id', runId)
        .eq('attempt', q.attempt)
        .limit(1)
      fail('addQaResult lookup', existing.error)
      if (existing.data && existing.data.length > 0) return false
      const { error } = await db.from('pf_qa_results').insert({
        run_id: runId,
        attempt: q.attempt,
        url: q.url,
        scores: q.scores,
        issues: q.issues,
        passed: q.passed,
        screenshot_url: q.screenshotUrl ?? null,
        workflow_run_url: q.workflowRunUrl ?? null,
      })
      fail('addQaResult', error)
      return true
    },

    async listQaResults(runId) {
      const { data, error } = await db
        .from('pf_qa_results')
        .select('*')
        .eq('run_id', runId)
        .order('attempt', { ascending: true })
        .returns<QaRow[]>()
      fail('listQaResults', error)
      return (data ?? []).map(qaFromRow)
    },

    async listRecentRuns(limit) {
      const { data, error } = await runs()
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<RunRow[]>()
      fail('listRecentRuns', error)
      const rows = data ?? []
      if (rows.length === 0) return []
      const firsts = await db
        .from('pf_qa_results')
        .select('*')
        .in(
          'run_id',
          rows.map((r) => r.id),
        )
        .eq('attempt', 1)
        .returns<QaRow[]>()
      fail('listRecentRuns qa', firsts.error)
      const byRun = new Map((firsts.data ?? []).map((q) => [q.run_id, qaFromRow(q)]))
      return rows.map((r) => summarize(fromRow(r), byRun.get(r.id)))
    },

    async countRunsSince(since) {
      const { count, error } = await runs()
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since.toISOString())
      fail('countRunsSince', error)
      return count ?? 0
    },

    async hitRateLimit(key, limit) {
      const { data, error } = await db.rpc('pf_hit_rate_limit', { p_key: key, p_limit: limit })
      fail('hitRateLimit', error)
      return data === true
    },

    async peekRateLimit(key) {
      const day = new Date().toISOString().slice(0, 10)
      const { data, error } = await db
        .from('pf_rate_limits')
        .select('count')
        .eq('key', key)
        .eq('day', day)
        .maybeSingle<{ count: number }>()
      fail('peekRateLimit', error)
      return data?.count ?? 0
    },
  }
}
