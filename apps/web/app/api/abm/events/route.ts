import { noContent, readBody } from '@/lib/abm/http'
import { recordEvent } from '@/lib/abm/public-actions'
import { handle } from '@/lib/abm/route'
import { trackEventSchema } from '@/lib/abm/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * First-party analytics beacon (navigator.sendBeacon). Always 204 so the
 * endpoint is no oracle for campaign ids; invalid bodies get 422.
 * 120 events per visitor per minute.
 */
export const POST = handle(async (req: Request) => {
  const body = await readBody(req, trackEventSchema)
  if (!body.ok) return body.response
  const outcome = await recordEvent(body.data)
  return noContent({ 'x-abm-event': outcome })
})
