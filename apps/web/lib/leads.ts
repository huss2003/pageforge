import 'server-only'
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { DemoFormState } from '@pageforge/ui/blocks'

/**
 * Demo requests from the Hoverline site.
 *
 * Field names the DemoForm block must use:
 *   name, email, company, role, siteType, message
 *   cf-turnstile-response (added by the Turnstile widget when enabled)
 *
 * Without Supabase configured the request is validated and acknowledged in
 * "demo mode" but not stored, because the site is a portfolio demo.
 */

export const demoRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(100, 'Keep your name under 100 characters.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'That email address is too long.')
    .pipe(z.email('Enter a work email address, like jo@company.com.')),
  company: z
    .string()
    .trim()
    .min(1, 'Enter your company.')
    .max(120, 'Keep the company name under 120 characters.'),
  role: z.string().trim().max(100, 'Keep your role under 100 characters.').optional(),
  siteType: z
    .enum(['refinery', 'substation', 'open-pit', 'other'], { error: 'Choose a site type.' })
    .optional(),
  message: z.string().trim().max(1000, 'Keep the message under 1,000 characters.').optional(),
})

export type DemoRequest = z.infer<typeof demoRequestSchema>

/** Per-IP submissions allowed per UTC day. */
export const LEAD_DAILY_LIMIT = 5

const emptyToUndefined = (v: FormDataEntryValue | null) =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined

export function parseDemoRequest(formData: FormData) {
  return demoRequestSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    company: formData.get('company') ?? '',
    role: emptyToUndefined(formData.get('role')),
    siteType: emptyToUndefined(formData.get('siteType')),
    message: emptyToUndefined(formData.get('message')),
  })
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

/** Cloudflare Turnstile server-side check. */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (error) {
    console.error('[leads] Turnstile verification failed', error)
    return false
  }
}

let supabase: SupabaseClient | null | undefined

/** Server-only Supabase client using the secret key; null when not configured. */
export function getSupabase(): SupabaseClient | null {
  if (supabase !== undefined) return supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  supabase =
    url && key
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      : null
  return supabase
}

export interface SubmitContext {
  ip?: string
  sourcePath?: string
  turnstileToken?: string
}

/** Validate, verify, rate-limit and store one demo request. */
export async function submitLead(formData: FormData, ctx: SubmitContext): Promise<DemoFormState> {
  const parsed = parseDemoRequest(formData)
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Check the highlighted fields and send the form again.',
      fieldErrors: fieldErrors(parsed.error),
    }
  }

  if (!(await verifyTurnstile(ctx.turnstileToken, ctx.ip))) {
    return {
      status: 'error',
      message:
        'We could not confirm you are human. Complete the check above the button and try again.',
    }
  }

  const db = getSupabase()
  if (!db) {
    return {
      status: 'success',
      message: `Thanks, ${parsed.data.name}. This site is a portfolio demo, so your request was checked but not stored and nobody will contact you.`,
    }
  }

  const ipKey = `lead:${hashIp(ctx.ip ?? 'unknown')}`
  const { data: allowed, error: limitError } = await db.rpc('pf_hit_rate_limit', {
    p_key: ipKey,
    p_limit: LEAD_DAILY_LIMIT,
  })
  if (limitError) {
    console.error('[leads] rate limit check failed', limitError.message)
    return {
      status: 'error',
      message: 'The form is unavailable right now. Try again in a few minutes.',
    }
  }
  if (allowed === false) {
    return {
      status: 'error',
      message: `This network has sent ${LEAD_DAILY_LIMIT} requests today. Try again tomorrow.`,
    }
  }

  const d = parsed.data
  const { error } = await db.from('pf_leads').insert({
    name: d.name,
    email: d.email,
    company: d.company,
    role: d.role ?? null,
    site_type: d.siteType ?? null,
    message: d.message ?? null,
    source_path: ctx.sourcePath?.slice(0, 200) ?? null,
  })
  if (error) {
    console.error('[leads] insert failed', error.message)
    return { status: 'error', message: 'Your request was not saved. Try again in a few minutes.' }
  }

  return {
    status: 'success',
    message: `Thanks, ${d.name}. Your request is in. This site is a portfolio demo, so it is stored for the demo only and nobody will contact you.`,
  }
}
