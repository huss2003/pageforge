import { getRunPayload, notFoundMessage } from '@/lib/factory/queries'
import { json, problem } from '@/lib/factory/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Run + steps + QA results. The IP hash never leaves the server. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const payload = await getRunPayload(id)
  if (!payload) return problem(404, notFoundMessage())
  return json(payload)
}
