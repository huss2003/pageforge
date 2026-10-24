import { clientIp, ipHash, json, problem, readBody, requireRole } from '@/lib/abm/http'
import { handle } from '@/lib/abm/route'
import { getAbmRuntime } from '@/lib/abm/runtime'
import { accountBriefSchema } from '@/lib/abm/schemas'
import { ensureDemoSeed } from '@/lib/abm/seed'
import { createCampaign, listCampaigns } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = handle(async (req: Request) => {
  const auth = requireRole(req, 'any')
  if (!auth.ok) return auth.response
  if (auth.session.workspace === 'demo') await ensureDemoSeed()
  return json({ campaigns: await listCampaigns(auth.session) })
})

export const POST = handle(async (req: Request) => {
  const auth = requireRole(req, ['marketer'])
  if (!auth.ok) return auth.response
  const body = await readBody(req, accountBriefSchema)
  if (!body.ok) return body.response
  if (auth.session.workspace === 'demo') {
    // Keep the public sandbox small: 20 new campaigns per network per day.
    const ok = await getAbmRuntime().store.hitRateLimit(`brief:${ipHash(clientIp(req))}`, 20)
    if (!ok)
      return problem(
        429,
        'This network has created 20 campaigns today. Try again tomorrow (00:00 UTC).',
      )
  }
  const campaign = await createCampaign(auth.session, body.data)
  return json({ campaignId: campaign.id }, { status: 201 })
})
