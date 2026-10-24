import { getAbmConfig } from '@/lib/abm/config'
import { clientIp, ipHash, json, problem, readBody, verifyTurnstile } from '@/lib/abm/http'
import { bookMeeting } from '@/lib/abm/public-actions'
import { handle } from '@/lib/abm/route'
import { getAbmRuntime } from '@/lib/abm/runtime'
import { meetingBodySchema } from '@/lib/abm/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Book a demo-calendar slot (no double booking). Turnstile when configured, 5 per IP per day. */
export const POST = handle(async (req: Request) => {
  const body = await readBody(req, meetingBodySchema)
  if (!body.ok) return body.response
  const ip = clientIp(req)
  if (!(await verifyTurnstile(body.data.turnstileToken, ip)))
    return problem(403, 'The human check did not pass. Complete it and book again.')
  const limit = getAbmConfig().limits.meetingsPerIpPerDay
  if (!(await getAbmRuntime().store.hitRateLimit(`meeting:${ipHash(ip)}`, limit)))
    return problem(429, 'Too many bookings from this network today. Try again tomorrow.')
  const { meeting, lead } = await bookMeeting(body.data)
  return json(
    { meetingId: meeting.id, leadId: lead.id, slotStart: meeting.slotStart },
    { status: 201 },
  )
})
