import { getConfig } from './config'
import { ADMIN_COOKIE, readCookie, sha256, verifyAdminSession } from './crypto'

/** Client IP as seen by Vercel / a reverse proxy. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Salted hash so raw IPs are never stored. */
export function ipHash(ip: string): string {
  return sha256(ip + getConfig().sessionSecret)
}

export function isAdminRequest(req: Request): boolean {
  const admin = getConfig().admin
  if (!admin) return false
  return verifyAdminSession(
    readCookie(req.headers.get('cookie'), ADMIN_COOKIE),
    admin.sessionSecret,
  )
}

export function json(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) },
  })
}

export function problem(status: number, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: message, ...extra }, { status })
}

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = getConfig().turnstile.secretKey
  if (!secret) return true
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip !== 'unknown' ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
