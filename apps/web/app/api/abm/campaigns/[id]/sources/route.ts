import { clientIp, ipHash, json, problem, readBody, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { getAbmRuntime } from '@/lib/abm/runtime'
import { sourcesBodySchema } from '@/lib/abm/schemas'
import { gatherSources } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Fetch the account's public pages and extract verbatim facts. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, sourcesBodySchema)
  if (!body.ok) return body.response
  if (auth.session.workspace === 'demo') {
    const ok = await getAbmRuntime().store.hitRateLimit(`sources:${ipHash(clientIp(req))}`, 20)
    if (!ok)
      return problem(
        429,
        'This network has fetched sources 20 times today. Try again tomorrow (00:00 UTC).',
      )
  }
  return json(await gatherSources(auth.session, (await ctx.params).id, body.data.urls))
})
