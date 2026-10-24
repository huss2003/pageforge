import { computeStats } from '@/lib/factory/stats'
import { json } from '@/lib/factory/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  return json(await computeStats())
}
