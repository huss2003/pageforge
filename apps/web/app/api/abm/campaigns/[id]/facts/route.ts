import { json, readBody, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { factsPatchSchema } from '@/lib/abm/schemas'
import { setFacts } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, factsPatchSchema)
  if (!body.ok) return body.response
  return json(await setFacts(auth.session, (await ctx.params).id, body.data))
})
