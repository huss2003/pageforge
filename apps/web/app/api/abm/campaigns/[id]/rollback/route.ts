import { json, readBody, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { versionRefSchema } from '@/lib/abm/schemas'
import { rollback } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Republish an earlier approved version. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, versionRefSchema)
  if (!body.ok) return body.response
  return json(await rollback(auth.session, (await ctx.params).id, body.data.versionId))
})
