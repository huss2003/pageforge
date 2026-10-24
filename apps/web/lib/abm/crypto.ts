import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function hmac(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

/** Constant-time string comparison; hashing first hides length differences. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // 32 symbols, no 0/o/1/l

/** Unguessable token for private page paths: 12 chars × 5 bits = 60 bits. */
export function randomToken(length = 12): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! & 31]
  return out
}

export const TOKEN_PATTERN = /^[a-z2-9]{12}$/

/** Read one cookie from a raw Cookie header. */
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
