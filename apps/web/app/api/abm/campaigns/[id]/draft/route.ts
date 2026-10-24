import { getAbmConfig } from '@/lib/abm/config'
import { clientIp, ipHash, json, problem, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { getAbmRuntime } from '@/lib/abm/runtime'
import { startDraft } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Start the AI draft (status generating → in_review); the work runs after the response. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  if (auth.session.workspace === 'demo') {
    const { limits } = getAbmConfig()
    const { store } = getAbmRuntime()
    if (!(await store.hitRateLimit(`draft:${ipHash(clientIp(req))}`, limits.draftsPerIpPerDay)))
      return problem(
        429,
        `This network has used its ${limits.draftsPerIpPerDay} drafts for today. Drafts reset at 00:00 UTC.`,
      )
    if (!(await store.hitRateLimit('draft:global', limits.draftsPerDay)))
      return problem(
        429,
        `The demo has reached its ${limits.draftsPerDay} drafts for today across all visitors. Drafts reset at 00:00 UTC.`,
      )
  }
  const result = await startDraft(auth.session, (await ctx.params).id)
  return json(result, { status: 202 })
})
