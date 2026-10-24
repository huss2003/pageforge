import { abmMode, getAbmConfig } from '@/lib/abm/config'
import { safeEqual } from '@/lib/abm/crypto'
import { json, noContent, problem, readBody } from '@/lib/abm/http'
import { handle } from '@/lib/abm/route'
import { getAbmRuntime } from '@/lib/abm/runtime'
import { sessionBodySchema } from '@/lib/abm/schemas'
import { ensureDemoSeed } from '@/lib/abm/seed'
import {
  SESSION_MS,
  clearSessionCookieHeader,
  sessionCookieHeader,
  sessionFromRequest,
  signSession,
} from '@/lib/abm/session'
import type { SessionInfo } from '@/lib/abm/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Start or switch a session. Demo: any role. Main: needs the workspace password. */
export const POST = handle(async (req: Request) => {
  const body = await readBody(req, sessionBodySchema)
  if (!body.ok) return body.response
  const { role, workspace, password } = body.data
  const config = getAbmConfig()
  if (workspace === 'main') {
    if (!config.adminPassword)
      return problem(403, 'The main workspace is off. Set FACTORY_ADMIN_PASSWORD to turn it on.')
    // Switching role inside an unlocked main session needs no password again.
    const current = sessionFromRequest(req, getAbmRuntime().now().getTime())
    const unlocked = current?.workspace === 'main'
    if (!unlocked && (!password || !safeEqual(password, config.adminPassword)))
      return problem(401, 'That workspace password is not right.')
  } else if (role === 'admin') {
    return problem(403, 'The admin role is only available in the main workspace.')
  }
  if (workspace === 'demo') await ensureDemoSeed()
  const expires = getAbmRuntime().now().getTime() + SESSION_MS
  const cookie = signSession({ workspace, role }, expires, config.sessionSecret)
  return json(
    { workspace, role },
    { headers: { 'set-cookie': sessionCookieHeader(cookie, new Date(expires)) } },
  )
})

/** Current session: { workspace, role, liveModels, mode }; 401 without a session. */
export const GET = handle(async (req: Request) => {
  const session = sessionFromRequest(req, getAbmRuntime().now().getTime())
  if (!session) return problem(401, 'No session. Choose a role to start.')
  const mode = abmMode()
  const body: SessionInfo = { ...session, liveModels: mode.models === 'live', mode }
  return json(body)
})

export const DELETE = handle(async () => noContent({ 'set-cookie': clearSessionCookieHeader() }))
