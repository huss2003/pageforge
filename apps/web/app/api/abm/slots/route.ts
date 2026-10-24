import { json, problem } from '@/lib/abm/http'
import { slotsFor } from '@/lib/abm/public-actions'
import { handle } from '@/lib/abm/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Open demo-calendar slots (UTC ISO) for the next 10 working days. */
export const GET = handle(async (req: Request) => {
  const id = new URL(req.url).searchParams.get('campaignId')
  if (id && id.length > 64) return problem(400, 'Invalid campaignId.')
  return json({ slots: await slotsFor(id || null) })
})
