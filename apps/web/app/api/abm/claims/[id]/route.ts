import { json, readBody, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { claimPatchSchema } from '@/lib/abm/schemas'
import { reviewClaim } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Reviewer marks a claim supported, needs_review or rejected (rejected text is removed). */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['reviewer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, claimPatchSchema)
  if (!body.ok) return body.response
  return json(await reviewClaim(auth.session, (await ctx.params).id, body.data))
})
