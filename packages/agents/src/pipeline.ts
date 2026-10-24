import type { Page } from '@pageforge/blocks'
import { isLlmError } from './llm/errors'
import { planPage } from './planner'
import { briefSchema } from './schemas'
import { finalizePage, rewritePage, writePage } from './writer'
import { validatePage, type ValidationIssue } from './validator'
import type {
  Brief,
  LlmResult,
  PagePlan,
  PipelineDeps,
  PipelineResult,
  RunPipeline,
  RunStatus,
  StepLog,
  StepName,
} from './types'

/** Writer retries after the first attempt fails validation. */
export const MAX_WRITE_RETRIES = 2

export class PipelineError extends Error {
  readonly steps: StepLog[]
  readonly plan?: PagePlan
  /** Last page produced, if any (useful for debugging a failed run). */
  readonly page?: unknown
  constructor(
    message: string,
    opts: { steps: StepLog[]; plan?: PagePlan; page?: unknown; cause?: unknown },
  ) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause })
    this.name = 'PipelineError'
    this.steps = opts.steps
    this.plan = opts.plan
    this.page = opts.page
  }
}

/** Shared step logger: timing, onStep callback, collected logs. */
export function createStepRecorder(deps: Pick<PipelineDeps, 'onStep' | 'now'>) {
  const now = deps.now ?? (() => new Date())
  const steps: StepLog[] = []
  const attempts = new Map<StepName, number>()

  async function record<T>(
    step: StepName,
    status: RunStatus,
    fn: () => Promise<{
      value: T
      summary: string
      ok?: boolean
      model?: string
      tokens?: StepLog['tokens']
      error?: string
    }>,
  ): Promise<T> {
    const attempt = (attempts.get(step) ?? 0) + 1
    attempts.set(step, attempt)
    const started = now()
    try {
      const r = await fn()
      const log: StepLog = {
        step,
        attempt,
        model: r.model,
        startedAt: started.toISOString(),
        durationMs: Math.max(0, now().getTime() - started.getTime()),
        tokens: r.tokens,
        ok: r.ok ?? true,
        summary: r.summary,
        ...(r.error ? { error: r.error } : {}),
      }
      steps.push(log)
      await deps.onStep?.(log, status)
      return r.value
    } catch (e) {
      const log: StepLog = {
        step,
        attempt,
        model: isLlmError(e) ? e.model : undefined,
        startedAt: started.toISOString(),
        durationMs: Math.max(0, now().getTime() - started.getTime()),
        tokens: isLlmError(e) ? e.tokens : undefined,
        ok: false,
        summary: `${stepVerb[step]} failed`,
        error: e instanceof Error ? e.message : String(e),
      }
      steps.push(log)
      await deps.onStep?.(log, 'failed')
      throw e
    }
  }
  return { steps, record }
}

const stepVerb: Record<StepName, string> = {
  plan: 'Planning',
  write: 'Writing',
  validate: 'Validation',
  draft: 'Saving the draft',
  qa: 'QA',
  fix: 'Fixing',
  publish: 'Publishing',
}

type WriteOutcome =
  | { ok: true; page: Page; result: LlmResult<Page> }
  | { ok: false; raw: unknown; issues: ValidationIssue[]; error: unknown }

/**
 * brief → plan → write → validate (≤2 writer retries) → saveDraft.
 *
 * Model calls per run: 1 plan + 1 write, plus at most 2 retries. Retries send
 * only the failing blocks with the validator's messages when possible.
 */
export const runPipeline: RunPipeline = async (briefInput, deps) => {
  const { steps, record } = createStepRecorder(deps)
  let plan: PagePlan | undefined
  let lastPage: unknown

  try {
    const brief: Brief = briefSchema.parse(briefInput)

    plan = await record('plan', 'planning', async () => {
      const res = await planPage(brief, deps)
      const focus = res.data.angle.replace(/[.]$/, '')
      return {
        value: res.data,
        model: res.model,
        tokens: res.tokens,
        summary: `Planned ${res.data.sections.length} sections around ${lowerFirst(focus, brief.prospect)}${res.repairs.length ? ` (${res.repairs.length} auto-corrections)` : ''}`,
      }
    })
    const thePlan = plan

    let page: Page | undefined
    let issues: ValidationIssue[] = []
    for (let attempt = 0; attempt <= MAX_WRITE_RETRIES; attempt++) {
      const outcome = await record<WriteOutcome>('write', 'writing', async () => {
        try {
          const res =
            attempt === 0
              ? await writePage(brief, thePlan, deps)
              : await rewritePage(brief, thePlan, lastPage, issues, deps)
          return {
            value: { ok: true, page: res.data, result: res },
            model: res.model,
            tokens: res.tokens,
            summary:
              attempt === 0
                ? `Wrote ${res.data.blocks.length} blocks, ${wordCount(res.data)} words`
                : `Rewrote ${issues.some((i) => i.blockKey) ? new Set(issues.map((i) => i.blockKey).filter(Boolean)).size + ' block(s)' : 'the page'} from validator feedback`,
          }
        } catch (e) {
          // The model answered, but the JSON broke the block contract:
          // treat it like a validation failure so the retry gets the errors.
          if (isLlmError(e) && e.kind === 'schema') {
            const raw = finalizeLoose(e.raw, brief, thePlan)
            const v = validatePage(raw, deps.facts, brief)
            return {
              value: { ok: false, raw, issues: v.issues, error: e },
              ok: false,
              model: e.model,
              tokens: e.tokens,
              summary: `Model output broke the block schema (${v.issues.length} problems)`,
              error: e.message,
            }
          }
          throw e
        }
      })

      if (outcome.ok) lastPage = outcome.page
      else lastPage = outcome.raw

      const result = await record('validate', 'validating', async () => {
        const v = outcome.ok
          ? validatePage(outcome.page, deps.facts, brief)
          : { ok: false, errors: outcome.issues.map((i) => i.message), issues: outcome.issues }
        return {
          value: v,
          ok: v.ok,
          summary: v.ok
            ? `Passed schema, placement, facts, banned-phrase and SEO checks`
            : `${v.errors.length} problem${v.errors.length === 1 ? '' : 's'}: ${v.errors[0]}`,
          ...(v.ok ? {} : { error: v.errors.slice(0, 10).join('\n') }),
        }
      })

      if (result.ok && outcome.ok) {
        page = outcome.page
        break
      }
      issues = result.issues
    }

    if (!page) {
      throw new Error(
        `Page still invalid after ${MAX_WRITE_RETRIES} retries: ${issues
          .slice(0, 3)
          .map((i) => i.message)
          .join(' | ')}`,
      )
    }

    const finalPage = page
    const draft = await record('draft', 'drafted', async () => {
      const d = await deps.saveDraft(finalPage)
      return { value: d, summary: `Saved draft “${finalPage.title}” at /${finalPage.slug}` }
    })

    return { page: finalPage, plan: thePlan, draft, steps } satisfies PipelineResult
  } catch (e) {
    if (e instanceof PipelineError) throw e
    const message = e instanceof Error ? e.message : String(e)
    if (!steps.some((s) => !s.ok && s.error === message)) {
      // Errors outside a recorded step (bad brief, exhausted retries) still reach the timeline.
      const log: StepLog = {
        step: steps.length ? steps[steps.length - 1]!.step : 'plan',
        attempt: 1,
        startedAt: (deps.now ?? (() => new Date()))().toISOString(),
        durationMs: 0,
        ok: false,
        summary: 'Run failed',
        error: message,
      }
      steps.push(log)
      await deps.onStep?.(log, 'failed')
    }
    throw new PipelineError(message, { steps, plan, page: lastPage, cause: e })
  }
}

/** Best-effort finalize of unparsed model output so the validator reports real paths. */
function finalizeLoose(raw: unknown, brief: Brief, plan: PagePlan): unknown {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { blocks?: unknown }).blocks)) {
    return raw
  }
  try {
    return finalizePage(raw as Page, brief, plan)
  } catch {
    return raw
  }
}

/** "Tank shell corrosion…" → "tank shell corrosion…", but keep proper nouns and acronyms. */
function lowerFirst(s: string, prospect: string) {
  const first = s.split(/\s+/)[0] ?? ''
  if (!first || /^[A-Z0-9]{2,}/.test(first) || prospect.includes(first)) return s
  return first[0]!.toLowerCase() + s.slice(1)
}

function wordCount(page: Page): number {
  let n = 0
  const visit = (v: unknown) => {
    if (typeof v === 'string') n += v.split(/\s+/).filter(Boolean).length
    else if (Array.isArray(v)) v.forEach(visit)
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) if (!k.startsWith('_') && k !== 'href') visit(x)
  }
  page.blocks.forEach(visit)
  return n
}
