import { json, readBody, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { requestChangesSchema } from '@/lib/abm/schemas'
import { requestChanges } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['reviewer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, requestChangesSchema)
  if (!body.ok) return body.response
  return json(await requestChanges(auth.session, (await ctx.params).id, body.data.note))
})
