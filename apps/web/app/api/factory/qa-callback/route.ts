import { z } from 'zod'
import { getConfig } from '@/lib/factory/config'
import { safeEqual } from '@/lib/factory/crypto'
import { handleQaResult } from '@/lib/factory/orchestrator'
import { json, problem } from '@/lib/factory/request'
import { getRuntime } from '@/lib/factory/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const score = z.number().min(0).max(100)

const callbackSchema = z.object({
  runId: z.string().uuid(),
  attempt: z.number().int().min(1).max(10),
  url: z.string().url().max(2000),
  scores: z.object({
    performance: score,
    accessibility: score,
    seo: score,
    bestPractices: score,
  }),
  issues: z
    .array(
      z.object({
        source: z.enum(['lighthouse', 'axe', 'visual']),
        id: z.string().max(120),
        message: z.string().transform((m) => m.slice(0, 1000)),
        blockKey: z.string().max(64).optional(),
      }),
    )
    .default([])
    .transform((list) => list.slice(0, 200)),
  passed: z.boolean(),
  screenshotUrl: z.string().url().max(2000).nullish(),
  workflowRunUrl: z.string().url().max(2000).nullish(),
})

/**
 * QA results posted by the GitHub Actions workflow. Idempotent per
 * (runId, attempt): a retried delivery answers 200 with `duplicate`.
 */
export async function POST(req: Request) {
  const secret = getConfig().qaCallbackSecret
  if (!secret) return problem(503, 'QA callbacks are disabled: QA_CALLBACK_SECRET is not set.')
  const given = req.headers.get('x-qa-secret') ?? ''
  if (!safeEqual(given, secret)) return problem(401, 'Invalid QA secret.')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return problem(400, 'Send the QA result as JSON.')
  }
  const parsed = callbackSchema.safeParse(body)
  if (!parsed.success) {
    return problem(422, 'QA result does not match the expected shape.', {
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
    })
  }

  const { runId, ...r } = parsed.data
  const { schedule, now } = getRuntime()
  const outcome = await handleQaResult(runId, {
    attempt: r.attempt,
    createdAt: now().toISOString(),
    url: r.url,
    scores: r.scores,
    issues: r.issues,
    passed: r.passed,
    simulated: false,
    screenshotUrl: r.screenshotUrl ?? null,
    workflowRunUrl: r.workflowRunUrl ?? null,
  })

  switch (outcome.kind) {
    case 'not-found':
      return problem(404, 'Run not found.')
    case 'duplicate':
      return json({ status: 'duplicate' })
    case 'stale':
      return problem(
        409,
        `Run is ${outcome.status}; expected QA attempt ${r.attempt} to be pending.`,
      )
    case 'ready':
      return json({ status: 'ready', passed: outcome.passed })
    case 'fixing':
      schedule(outcome.next)
      return json({ status: 'fixing' }, { status: 202 })
  }
}
