import 'server-only'
import { cookies, headers } from 'next/headers'
import { getConfig } from './config'
import { ADMIN_COOKIE, verifyAdminSession } from './crypto'
import { getQuota } from './orchestrator'
import { ipHash } from './request'

/** True when the current request carries a valid admin cookie (server components). */
export async function isAdmin(): Promise<boolean> {
  const admin = getConfig().admin
  if (!admin) return false
  const jar = await cookies()
  return verifyAdminSession(jar.get(ADMIN_COOKIE)?.value, admin.sessionSecret)
}

/** Remaining runs for the caller, for server-rendered headers. */
export async function quotaForRequest() {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return getQuota(ipHash(ip))
}
