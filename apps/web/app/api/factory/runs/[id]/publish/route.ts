import { publishRun } from '@/lib/factory/orchestrator'
import { isAdminRequest, json, problem } from '@/lib/factory/request'
import { toPublicRun } from '@/lib/factory/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const result = await publishRun(id, { admin: isAdminRequest(req) })
  if (!result.ok) return problem(result.status, result.error)
  return json({
    run: toPublicRun(result.run),
    liveUrl: result.liveUrl,
    timeToShipMs: result.run.timeToShipMs,
  })
}
