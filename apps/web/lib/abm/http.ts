import { z } from 'zod'
import { safeErrorMessage } from '@/lib/env'
import { getAbmConfig } from './config'
import { sha256 } from './crypto'
import { getAbmRuntime } from './runtime'
import { sessionFromRequest, type AbmSession } from './session'
import type { Role } from './types'

/** JSON response with cache-control: no-store (every ABM API answer). */
export function json(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) },
  })
}

export function problem(status: number, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: message, ...extra }, { status })
}

export function noContent(headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', ...headers } })
}

/** Errors the service raises for the route to turn into a response. */
export class AbmError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'AbmError'
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Salted hash so raw IPs are never stored. */
export function ipHash(ip: string): string {
  return sha256(`${ip}|${getAbmConfig().sessionSecret}`).slice(0, 32)
}

const MAX_BODY = 64 * 1024

/** Parse a JSON body (≤ 64 KB) with a zod schema. */
export async function readBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let text: string
  try {
    text = await req.text()
  } catch {
    return { ok: false, response: problem(400, 'Could not read the request body.') }
  }
  if (text.length > MAX_BODY)
    return { ok: false, response: problem(413, 'The request body is too large.') }
  let raw: unknown
  try {
    raw = text ? JSON.parse(text) : {}
  } catch {
    return { ok: false, response: problem(400, 'Send the body as JSON.') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const i of parsed.error.issues) {
      const k = i.path.join('.') || '_'
      fields[k] ??= i.message
    }
    return { ok: false, response: problem(422, 'Some fields need attention.', { fields }) }
  }
  return { ok: true, data: parsed.data }
}

/** Session with one of `roles` (admin always passes), else a 401/403 response. */
export function requireRole(
  req: Request,
  roles: Role[] | 'any',
): { ok: true; session: AbmSession } | { ok: false; response: Response } {
  const session = sessionFromRequest(req, getAbmRuntime().now().getTime())
  if (!session) return { ok: false, response: problem(401, 'Choose a role to start a session.') }
  if (roles !== 'any' && session.role !== 'admin' && !roles.includes(session.role)) {
    return {
      ok: false,
      response: problem(
        403,
        `This action needs the ${roles.join(' or ')} role. Switch role and try again.`,
      ),
    }
  }
  return { ok: true, session }
}

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = getAbmConfig().turnstile.secretKey
  if (!secret) return true
  if (!token) return false
  try {
    const res = await getAbmRuntime().fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: new URLSearchParams({
          secret,
          response: token,
          ...(ip !== 'unknown' ? { remoteip: ip } : {}),
        }),
        signal: AbortSignal.timeout(8000),
      },
    )
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

/** Map a thrown error to a response; unknown errors are logged redacted. */
export function errorResponse(e: unknown): Response {
  if (e instanceof AbmError) return problem(e.status, e.message, e.extra)
  console.error('[abm]', safeErrorMessage(e))
  return problem(500, 'Something went wrong on our side. Try again in a moment.')
}
