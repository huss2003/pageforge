import { json, readBody, requireRole } from '@/lib/abm/http'
import { handle, type Ctx } from '@/lib/abm/route'
import { versionPatchSchema } from '@/lib/abm/schemas'
import { editVersion } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Edit fields, CTA or SEO. Editing an approved version creates a new 'edit' version. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, versionPatchSchema)
  if (!body.ok) return body.response
  return json(await editVersion(auth.session, (await ctx.params).id, body.data))
})
