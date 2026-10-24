import { json, readBody, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { publishSchema } from '@/lib/abm/schemas'
import { publish } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Publish an approved version. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, publishSchema)
  if (!body.ok) return body.response
  const { versionId, expiresAt } = body.data
  return json(
    await publish(
      auth.session,
      (await ctx.params).id,
      versionId,
      expiresAt === undefined ? {} : { expiresAt },
    ),
  )
})
