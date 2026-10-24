import { json, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { resume } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  return json(await resume(auth.session, (await ctx.params).id))
})
