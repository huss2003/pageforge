import { json, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { getCampaignDetail } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, 'any')
  if (!auth.ok) return auth.response
  return json(await getCampaignDetail(auth.session, (await ctx.params).id))
})
