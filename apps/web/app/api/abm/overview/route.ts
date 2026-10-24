import { json, requireRole } from '@/lib/abm/http'
import { handle } from '@/lib/abm/route'
import { ensureDemoSeed } from '@/lib/abm/seed'
import { overview } from '@/lib/abm/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = handle(async (req: Request) => {
  const auth = requireRole(req, 'any')
  if (!auth.ok) return auth.response
  if (auth.session.workspace === 'demo') await ensureDemoSeed()
  return json(await overview(auth.session))
})
