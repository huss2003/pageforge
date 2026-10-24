/**
 * Secrets from the environment.
 *
 * Keys and tokens never contain whitespace, but a value pasted into a
 * dashboard can pick up a line break in the middle. `secretEnv` strips ALL
 * whitespace so a wrapped paste still works, and `redactSecrets` scrubs any
 * secret-looking string from messages before they are logged, stored or
 * shown, so a library error that echoes a header value never leaks it.
 */

const SECRET_NAMES = [
  'SUPABASE_SECRET_KEY',
  'SANITY_API_WRITE_TOKEN',
  'SANITY_API_READ_TOKEN',
  'SANITY_REVALIDATE_SECRET',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'FACTORY_ADMIN_PASSWORD',
  'SESSION_SECRET',
  'HUBSPOT_PRIVATE_APP_TOKEN',
] as const

export type SecretName = (typeof SECRET_NAMES)[number]

/** A secret with every whitespace character removed, or null when unset. */
export function secretEnv(name: SecretName): string | null {
  const raw = process.env[name]
  if (!raw) return null
  const v = raw.replace(/\s+/g, '')
  return v || null
}

/** Patterns for credential formats this app handles, redacted even if unknown. */
const PATTERNS: RegExp[] = [
  /sb_(secret|publishable)_[A-Za-z0-9_-]+/g, // Supabase API keys
  /\bsk[A-Za-z0-9]{30,}\b/g, // Sanity tokens
  /\bAIza[0-9A-Za-z_-]{20,}\b/g, // Google API keys
  /\bgsk_[A-Za-z0-9]{20,}\b/g, // Groq keys
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, // GitHub fine-grained tokens
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub classic tokens
  /\b0x4[A-Za-z0-9_-]{30,}\b/g, // Turnstile secret keys
  /\bpat-(?:na|eu|ap)\d-[0-9a-f-]{20,}\b/gi, // HubSpot private app tokens
]

/** Replace every configured secret value and credential-shaped string with [redacted]. */
export function redactSecrets(message: string): string {
  let out = message
  for (const name of SECRET_NAMES) {
    const raw = process.env[name]
    if (!raw) continue
    // Redact the value as configured, without whitespace, and each wrapped line of it.
    const variants = new Set([raw, raw.replace(/\s+/g, ''), ...raw.split(/\s+/)])
    for (const v of variants) {
      if (v.length >= 8) out = out.split(v).join('[redacted]')
    }
  }
  for (const p of PATTERNS) out = out.replace(p, '[redacted]')
  return out
}

/** Error → safe one-line message (redacted, first line, bounded). */
export function safeErrorMessage(err: unknown, max = 500): string {
  const raw = err instanceof Error ? err.message : String(err)
  return redactSecrets(raw).split('\n')[0]!.slice(0, max)
}
