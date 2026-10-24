import 'server-only'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Page } from '@pageforge/blocks'
import { facts } from '@pageforge/content'
import { meetsThresholds, type QaResult } from '@pageforge/qa'
import { getConfig, publicMode } from './config'
import { previewPath } from './crypto'
import { diffPages } from './diff'
import {
  createLlmFromEnv,
  dispatchQaRun,
  fixPage,
  runPipeline,
  type LlmClient,
  type PagePlan,
  type RunStatus,
  type StepLog,
} from './engine'
import { publishSanityPage, saveSanityDraft } from './sanity'
import { getRuntime } from './store'
import type { QaRecord, RunRecord } from './types'
import { safeErrorMessage, secretEnv } from '@/lib/env'

/** Pacing for simulated runs so the live timeline is watchable (ms per model call). */
const SIM_PACE: Record<string, number> = { planner: 1800, writer: 2600, fixer: 1600 }
const SIM_QA_MS = 2800

function isPlan(v: unknown): v is PagePlan {
  return Boolean(
    v &&
    typeof v === 'object' &&
    Array.isArray((v as PagePlan).sections) &&
    typeof (v as PagePlan).slug === 'string' &&
    typeof (v as PagePlan).angle === 'string',
  )
}

/**
 * Wrap the model client: pace simulated calls, and persist the plan as soon
 * as the planner returns so the dashboard can show it while copy is written.
 */
function instrumentLlm(llm: LlmClient, simulated: boolean, runId: string): LlmClient {
  const { store, sleep } = getRuntime()
  return {
    async generateJson(opts) {
      if (simulated) await sleep(SIM_PACE[opts.task] ?? 1200)
      const result = await llm.generateJson(opts)
      if (isPlan(result.data)) {
        await store.updateRun(runId, { plan: result.data, model: result.model })
      }
      return result
    },
  }
}

function modelEnv(): Record<string, string | undefined> {
  return {
    GEMINI_API_KEY: secretEnv('GEMINI_API_KEY') ?? undefined,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GROQ_API_KEY: secretEnv('GROQ_API_KEY') ?? undefined,
    GROQ_MODEL: process.env.GROQ_MODEL,
  }
}

/** True when the engine would use the fake model (no keys, or no real engine yet). */
export function isSimulatedEnv(): boolean {
  return createLlmFromEnv(modelEnv()).simulated
}

/** Honest mode for the dashboard header: what will actually run. */
export function factoryMode() {
  const config = getConfig()
  const simulated = isSimulatedEnv()
  return {
    ...publicMode(config),
    models: simulated ? ('simulated' as const) : ('live' as const),
    qa: config.liveQa && !simulated ? ('live' as const) : ('simulated' as const),
    sanityWrites: config.sanity !== null,
  }
}
export type FactoryMode = ReturnType<typeof factoryMode>

/** Demo pages get a run-specific slug so sandbox URLs never collide. */
function sandboxSlug(slug: string, runId: string) {
  const suffix = runId.replace(/-/g, '').slice(0, 6)
  return `${slug.slice(0, 80 - suffix.length - 1).replace(/-+$/, '')}-${suffix}`
}

async function logStep(runId: string, log: StepLog, status?: RunStatus) {
  const { store } = getRuntime()
  await store.appendStep(runId, log)
  if (status) await store.updateRun(runId, { status, ...(log.model ? { model: log.model } : {}) })
}

function deps(run: RunRecord) {
  const raw = createLlmFromEnv(modelEnv())
  const llm = instrumentLlm(raw, raw.simulated, run.id)
  const { now } = getRuntime()
  return { llm, simulated: raw.simulated, now }
}

// ---------------------------------------------------------------------------
// 1. Brief → draft
// ---------------------------------------------------------------------------

export async function executeRun(runId: string): Promise<void> {
  const { store, now } = getRuntime()
  const config = getConfig()
  const run = await store.getRun(runId)
  if (!run || run.status !== 'queued') return

  const { llm, simulated } = deps(run)
  const preview = `${config.siteUrl}${previewPath(runId, config.previewSecret)}`

  try {
    await store.updateRun(runId, { status: 'planning', startedAt: now().toISOString(), simulated })

    const result = await runPipeline(run.brief, {
      llm,
      facts,
      now,
      onStep: (log, status) => logStep(runId, log, status),
      saveDraft: async (draft) => {
        const page: Page = {
          ...draft,
          slug: run.mode === 'demo' ? sandboxSlug(draft.slug, runId) : draft.slug,
          generatedBy: {
            runId,
            model: draft.generatedBy?.model ?? (simulated ? 'simulated' : 'unknown'),
          },
        }
        const sanityId = run.mode === 'production' ? await saveSanityDraft(page) : null
        await store.updateRun(runId, { page, slug: page.slug, previewUrl: preview })
        return { id: sanityId ?? `run:${runId}`, previewUrl: preview }
      },
    })

    const stored = await store.getRun(runId)
    const page = stored?.page ?? result.page
    await store.updateRun(runId, {
      plan: result.plan,
      page,
      slug: page.slug,
      draftId: result.draft.id,
      previewUrl: result.draft.previewUrl,
    })
    await startQa(runId, 1)
  } catch (err) {
    await failRun(runId, err)
  }
}

async function failRun(runId: string, err: unknown) {
  const { store } = getRuntime()
  const message = safeErrorMessage(err)
  await store.updateRun(runId, { status: 'failed', error: message.slice(0, 500) }).catch(() => {})
}

// ---------------------------------------------------------------------------
// 2. QA dispatch (live) or inline simulation
// ---------------------------------------------------------------------------

async function startQa(runId: string, attempt: number): Promise<void> {
  const { store, sleep, now, simulateQa } = getRuntime()
  const config = getConfig()
  const run = await store.updateRun(runId, { status: 'qa-running' })
  const url = run.previewUrl ?? `${config.siteUrl}${previewPath(runId, config.previewSecret)}`

  if (config.liveQa && !run.simulated) {
    const started = now()
    try {
      await dispatchQaRun({
        runId,
        url,
        attempt,
        callbackUrl: `${config.siteUrl}/api/factory/qa-callback`,
      })
      await store.appendStep(runId, {
        step: 'qa',
        attempt,
        model: 'lighthouse + axe',
        startedAt: started.toISOString(),
        durationMs: now().getTime() - started.getTime(),
        ok: true,
        summary: 'Dispatched Lighthouse and axe to GitHub Actions. Waiting for results.',
      })
      return
    } catch (err) {
      await store.appendStep(runId, {
        step: 'qa',
        attempt,
        startedAt: started.toISOString(),
        durationMs: now().getTime() - started.getTime(),
        ok: false,
        summary: 'GitHub Actions dispatch failed; running simulated QA instead.',
        error: safeErrorMessage(err),
      })
    }
  }

  // Simulated QA: score the page content inline, then continue the loop.
  const started = now()
  await sleep(SIM_QA_MS)
  if (!run.page) throw new Error('No page to test.')
  const result = simulateQa(run.page, url, attempt, now())
  await store.appendStep(runId, {
    step: 'qa',
    attempt,
    model: 'simulated',
    startedAt: started.toISOString(),
    durationMs: now().getTime() - started.getTime(),
    ok: result.passed,
    summary: qaSummary(result),
  })
  const outcome = await handleQaResult(runId, result)
  if (outcome.kind === 'fixing') await outcome.next()
}

function qaSummary(r: QaRecord): string {
  const s = r.scores
  const head = `${r.simulated ? 'Simulated QA' : 'QA'}: performance ${s.performance}, accessibility ${s.accessibility}, SEO ${s.seo}, best practices ${s.bestPractices}.`
  if (r.passed) return `${head} Meets every threshold.`
  return `${head} ${r.issues.length} issue${r.issues.length === 1 ? '' : 's'} to fix.`
}

// ---------------------------------------------------------------------------
// 3. QA result → fix loop or ready (shared by callback and simulation)
// ---------------------------------------------------------------------------

export type QaOutcome =
  | { kind: 'not-found' }
  | { kind: 'duplicate' }
  | { kind: 'stale'; status: RunStatus }
  | { kind: 'ready'; passed: boolean }
  | { kind: 'fixing'; next: () => Promise<void> }

/**
 * Record a QA result exactly once per (runId, attempt). The claim is a
 * compare-and-set on (status = qa-running, qa_attempts = attempt - 1), so a
 * retried webhook or a duplicate delivery is a no-op.
 *
 * Returns the follow-up work (fix + re-dispatch) instead of running it, so
 * the webhook can answer immediately and continue in `after()`.
 */
export async function handleQaResult(runId: string, result: QaRecord): Promise<QaOutcome> {
  const { store, now } = getRuntime()
  const max = getConfig().limits.maxQaAttempts
  const run = await store.getRun(runId)
  if (!run) return { kind: 'not-found' }

  const existing = await store.listQaResults(runId)
  if (existing.some((q) => q.attempt === result.attempt)) return { kind: 'duplicate' }

  const passed = result.passed && meetsThresholds(result.scores)
  const record: QaRecord = { ...result, passed }
  const willFix = !passed && result.attempt < max
  const claimed = await store.claimRun(
    runId,
    { status: 'qa-running', qaAttempts: result.attempt - 1 },
    willFix
      ? { status: 'fixing', qaAttempts: result.attempt, lastQa: record }
      : {
          status: 'ready',
          qaAttempts: result.attempt,
          lastQa: record,
          readyAt: now().toISOString(),
        },
  )
  if (!claimed) {
    // Lost the race: if another delivery already recorded this attempt, it is a duplicate.
    const latest = await store.getRun(runId)
    if (latest && latest.qaAttempts >= result.attempt) return { kind: 'duplicate' }
    return { kind: 'stale', status: latest?.status ?? run.status }
  }
  await store.addQaResult(runId, record)

  if (!willFix) return { kind: 'ready', passed }
  return { kind: 'fixing', next: () => runFix(runId, record) }
}

async function runFix(runId: string, qa: QaRecord): Promise<void> {
  const { store, now } = getRuntime()
  try {
    const run = await store.getRun(runId)
    if (!run?.page || run.status !== 'fixing') return
    const { llm } = deps(run)
    const qaResult: QaResult = {
      url: qa.url,
      scores: qa.scores,
      issues: qa.issues,
      passed: qa.passed,
    }
    const fixed = await fixPage(run.page, qaResult, {
      llm,
      facts,
      now,
      onStep: (log) => logStep(runId, { ...log, attempt: qa.attempt }, 'fixing'),
    })
    // The fixer may not touch identity fields; keep the run's slug and attribution.
    const page: Page = { ...fixed.page, slug: run.page.slug, generatedBy: run.page.generatedBy }
    const changes = diffPages(run.page, page)
    await store.updateRun(runId, {
      page,
      fixes: [...run.fixes, { attempt: qa.attempt, at: now().toISOString(), changes }],
    })
    if (run.mode === 'production') await saveSanityDraft(page)
    await startQa(runId, qa.attempt + 1)
  } catch (err) {
    await failRun(runId, err)
  }
}

// ---------------------------------------------------------------------------
// 4. Publish
// ---------------------------------------------------------------------------

export type PublishOutcome =
  { ok: true; run: RunRecord; liveUrl: string } | { ok: false; status: number; error: string }

export function liveUrlFor(run: Pick<RunRecord, 'mode' | 'slug'>): string {
  return run.mode === 'production' ? `/lp/${run.slug}` : `/factory/p/${run.slug}`
}

export async function publishRun(runId: string, opts: { admin: boolean }): Promise<PublishOutcome> {
  const { store, now } = getRuntime()
  const run = await store.getRun(runId)
  if (!run)
    return { ok: false, status: 404, error: 'Run not found. Check the link or start a new run.' }
  if (run.status === 'published') return { ok: true, run, liveUrl: liveUrlFor(run) }
  if (run.status !== 'ready' || !run.page || !run.slug) {
    return {
      ok: false,
      status: 409,
      error: `This run is ${run.status}. Publishing opens once QA has finished and the run is ready.`,
    }
  }
  if (run.mode === 'production' && !opts.admin) {
    return {
      ok: false,
      status: 403,
      error: 'Production pages can only be published by the admin. Log in and try again.',
    }
  }

  const started = now()
  if (run.mode === 'production') {
    try {
      await publishSanityPage(run.page)
    } catch (err) {
      return {
        ok: false,
        status: 502,
        error: `Sanity rejected the publish: ${safeErrorMessage(err, 200)}. The run is still ready; try again.`,
      }
    }
  } else {
    const clash = await store.findPublished(run.mode, run.slug)
    if (clash && clash.id !== run.id) {
      return { ok: false, status: 409, error: 'Another run already published this slug.' }
    }
  }

  const publishedAt = now()
  const claimed = await store.claimRun(
    runId,
    { status: 'ready' },
    {
      status: 'published',
      publishedAt: publishedAt.toISOString(),
      timeToShipMs: publishedAt.getTime() - new Date(run.createdAt).getTime(),
    },
  )
  if (!claimed) {
    const latest = await store.getRun(runId)
    if (latest?.status === 'published')
      return { ok: true, run: latest, liveUrl: liveUrlFor(latest) }
    return {
      ok: false,
      status: 409,
      error: 'The run changed while publishing. Reload and try again.',
    }
  }

  const liveUrl = liveUrlFor(claimed)
  await store.appendStep(runId, {
    step: 'publish',
    attempt: 1,
    startedAt: started.toISOString(),
    durationMs: now().getTime() - started.getTime(),
    ok: true,
    summary:
      run.mode === 'production'
        ? `Published to Sanity as page-${run.slug} and revalidated ${liveUrl}.`
        : `Published to the Factory sandbox at ${liveUrl}.`,
  })

  if (run.mode === 'production') {
    try {
      revalidateTag(`page:${run.slug}`, { expire: 0 })
      revalidateTag('pages', { expire: 0 })
      revalidatePath(liveUrl)
    } catch {
      // Outside a request scope (tests); the next request revalidates anyway.
    }
  }
  return { ok: true, run: claimed, liveUrl }
}

// ---------------------------------------------------------------------------
// Quota
// ---------------------------------------------------------------------------

export const GLOBAL_KEY = 'run:global'
export const ipKey = (hash: string) => `run:${hash}`

export async function getQuota(ipHash: string | null) {
  const { store } = getRuntime()
  const { limits } = getConfig()
  const [globalUsed, ipUsed] = await Promise.all([
    store.peekRateLimit(GLOBAL_KEY),
    ipHash ? store.peekRateLimit(ipKey(ipHash)) : Promise.resolve(0),
  ])
  const globalLeft = Math.max(0, limits.globalPerDay - globalUsed)
  const ipLeft = Math.max(0, limits.perIpPerDay - ipUsed)
  return {
    globalUsed: Math.min(globalUsed, limits.globalPerDay),
    globalCap: limits.globalPerDay,
    ipUsed: Math.min(ipUsed, limits.perIpPerDay),
    ipCap: limits.perIpPerDay,
    remaining: Math.min(globalLeft, ipLeft),
  }
}
