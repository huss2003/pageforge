import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function hmac(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

/** Constant-time string comparison that does not leak length via early exit. */
export function safeEqual(a: string, b: string): boolean {
  // Hash both sides so inputs of different length compare in constant time.
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}

// Preview tokens ------------------------------------------------------------

export function previewToken(runId: string, secret: string): string {
  return hmac(`preview:${runId}`, secret)
}

export function verifyPreviewToken(
  runId: string,
  token: string | null | undefined,
  secret: string,
): boolean {
  if (!token) return false
  return safeEqual(token, previewToken(runId, secret))
}

export function previewPath(runId: string, secret: string): string {
  return `/preview/${runId}?t=${previewToken(runId, secret)}`
}

// Admin session cookie --------------------------------------------------------

export const ADMIN_COOKIE = 'pf_admin'
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000

/** Cookie value: `<expiry ms>.<hmac>`. */
export function signAdminSession(expiresAt: number, secret: string): string {
  const exp = String(Math.floor(expiresAt))
  return `${exp}.${hmac(`admin:${exp}`, secret)}`
}

export function verifyAdminSession(
  value: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!value) return false
  const dot = value.indexOf('.')
  if (dot <= 0) return false
  const exp = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  if (!/^\d{1,16}$/.test(exp)) return false
  if (!safeEqual(sig, hmac(`admin:${exp}`, secret))) return false
  return Number(exp) > now
}

/** Read one cookie from a raw Cookie header (route handlers stay testable). */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}
