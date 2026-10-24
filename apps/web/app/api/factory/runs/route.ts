import { parseBrief } from '@/lib/factory/brief'
import { getConfig } from '@/lib/factory/config'
import { GLOBAL_KEY, executeRun, getQuota, ipKey, isSimulatedEnv } from '@/lib/factory/orchestrator'
import {
  clientIp,
  ipHash,
  isAdminRequest,
  json,
  problem,
  verifyTurnstile,
} from '@/lib/factory/request'
import { getRuntime } from '@/lib/factory/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Start a run: validate the brief, check limits, answer with the id, work in `after()`. */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return problem(400, 'Send the brief as JSON.')
  }

  const parsed = parseBrief(body)
  if (!parsed.ok) {
    return problem(422, 'Some fields need attention.', { fieldErrors: parsed.fieldErrors })
  }

  const config = getConfig()
  const { store, schedule } = getRuntime()
  const admin = isAdminRequest(req)
  const ip = clientIp(req)
  const hash = ipHash(ip)

  if (!admin && !(await verifyTurnstile(parsed.turnstileToken, ip))) {
    return problem(
      403,
      'The human check did not pass. Complete the check above the button and submit again.',
    )
  }

  if (!admin && !(await store.hitRateLimit(ipKey(hash), config.limits.perIpPerDay))) {
    return problem(
      429,
      `This network has used its ${config.limits.perIpPerDay} runs for today. Runs reset at 00:00 UTC; past runs stay open under Runs.`,
      { quota: await getQuota(hash) },
    )
  }
  if (!(await store.hitRateLimit(GLOBAL_KEY, config.limits.globalPerDay))) {
    return problem(
      429,
      `The demo has reached its ${config.limits.globalPerDay} runs for today across all visitors. Runs reset at 00:00 UTC.`,
      { quota: await getQuota(hash) },
    )
  }

  const mode = admin && parsed.mode === 'production' ? 'production' : 'demo'
  if (mode === 'production' && !config.sanity) {
    return problem(
      409,
      'Production runs publish to Sanity, which is not configured. Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN, or run in demo mode.',
    )
  }

  const run = await store.createRun({
    mode,
    brief: parsed.brief,
    simulated: isSimulatedEnv(),
    ipHash: hash,
  })
  schedule(() => executeRun(run.id))

  return json({ runId: run.id, mode }, { status: 201 })
}

/** Recent runs for the history table. */
export async function GET() {
  const runs = await getRuntime().store.listRecentRuns(50)
  return json({ runs })
}
