import { getAbmConfig } from './config'
import { hmac, readCookie, safeEqual } from './crypto'
import type { Role, Workspace } from './types'

/**
 * Session cookie `pf_abm`: `<base64url JSON {w, r, e}>.<HMAC-SHA256>`,
 * signed with SESSION_SECRET. httpOnly, SameSite=Lax, 12 hours.
 */
export const SESSION_COOKIE = 'pf_abm'
export const SESSION_MS = 12 * 60 * 60 * 1000

export interface AbmSession {
  workspace: Workspace
  role: Role
}

const ROLES: Role[] = ['marketer', 'sales', 'reviewer', 'admin']

export function signSession(s: AbmSession, expiresAt: number, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ w: s.workspace, r: s.role, e: Math.floor(expiresAt) }),
  ).toString('base64url')
  return `${payload}.${hmac(`abm:${payload}`, secret)}`
}

export function verifySession(
  value: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): AbmSession | null {
  if (!value || value.length > 512) return null
  const dot = value.indexOf('.')
  if (dot <= 0) return null
  const payload = value.slice(0, dot)
  if (!safeEqual(value.slice(dot + 1), hmac(`abm:${payload}`, secret))) return null
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      w?: unknown
      r?: unknown
      e?: unknown
    }
    if (p.w !== 'demo' && p.w !== 'main') return null
    if (!ROLES.includes(p.r as Role)) return null
    if (typeof p.e !== 'number' || p.e <= now) return null
    return { workspace: p.w, role: p.r as Role }
  } catch {
    return null
  }
}

export function sessionFromRequest(req: Request, now = Date.now()): AbmSession | null {
  return verifySession(
    readCookie(req.headers.get('cookie'), SESSION_COOKIE),
    getAbmConfig().sessionSecret,
    now,
  )
}

export function sessionCookieHeader(value: string, expires: Date): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
