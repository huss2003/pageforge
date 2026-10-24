import { json, readBody, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { duplicateSchema } from '@/lib/abm/schemas'
import { duplicate } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Copy the campaign for another account; account facts are cleared. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, duplicateSchema)
  if (!body.ok) return body.response
  const campaign = await duplicate(auth.session, (await ctx.params).id, body.data.brief)
  return json({ campaignId: campaign.id }, { status: 201 })
})
