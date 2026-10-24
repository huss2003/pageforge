import { getAbmConfig } from '@/lib/abm/config'
import {
  AbmError,
  clientIp,
  ipHash,
  json,
  problem,
  readBody,
  requireRole,
  verifyTurnstile,
} from '@/lib/abm/http'
import { submitLead } from '@/lib/abm/public-actions'
import { handle } from '@/lib/abm/route'
import { getAbmRuntime } from '@/lib/abm/runtime'
import { leadBodySchema } from '@/lib/abm/schemas'
import { ensureDemoSeed } from '@/lib/abm/seed'
import { leadsFor } from '@/lib/abm/service-analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Built-in CRM view: leads of the session's workspace. */
export const GET = handle(async (req: Request) => {
  const auth = requireRole(req, ['marketer', 'sales'])
  if (!auth.ok) return auth.response
  if (auth.session.workspace === 'demo') await ensureDemoSeed()
  const campaigns = await getAbmRuntime().store.listCampaigns(auth.session.workspace)
  return json({ leads: await leadsFor(campaigns, auth.session.workspace) })
})

/** Public demo form submit: Turnstile (when configured), 5 per IP per day. */
export const POST = handle(async (req: Request) => {
  const body = await readBody(req, leadBodySchema)
  if (!body.ok) return body.response
  const ip = clientIp(req)
  if (!(await verifyTurnstile(body.data.turnstileToken, ip)))
    return problem(403, 'The human check did not pass. Complete it and submit again.')
  const limit = getAbmConfig().limits.leadsPerIpPerDay
  if (!(await getAbmRuntime().store.hitRateLimit(`lead:${ipHash(ip)}`, limit)))
    return problem(429, 'Too many requests from this network today. Try again tomorrow.')
  try {
    const lead = await submitLead(body.data)
    return json({ leadId: lead.id }, { status: 201 })
  } catch (e) {
    if (e instanceof AbmError) return problem(e.status, e.message, e.extra)
    throw e
  }
})
