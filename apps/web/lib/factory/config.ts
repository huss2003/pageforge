import { randomBytes } from 'node:crypto'
import { siteUrl } from '@/lib/site'
import { secretEnv } from '@/lib/env'

/**
 * Factory configuration, read from the environment once per call so tests
 * can change `process.env` between cases. Every value is optional: with no
 * keys at all the Factory runs end to end in simulation mode.
 */
export interface FactoryConfig {
  siteUrl: string
  /** Real models available (Gemini or Groq key set). */
  liveModels: boolean
  /** QA runs in GitHub Actions; otherwise it is simulated inline. */
  liveQa: boolean
  supabase: { url: string; secretKey: string } | null
  sanity: {
    projectId: string
    dataset: string
    demoDataset: string
    writeToken: string
  } | null
  turnstile: { siteKey: string | null; secretKey: string | null }
  admin: { password: string; sessionSecret: string } | null
  previewSecret: string
  sessionSecret: string
  qaCallbackSecret: string | null
  limits: { perIpPerDay: number; globalPerDay: number; maxQaAttempts: number }
}

/**
 * Fallback for PREVIEW_SECRET / SESSION_SECRET: random per server instance.
 * Preview links then only verify on the instance that issued them, which is
 * the same constraint as the in-memory store used without Supabase.
 */
const g = globalThis as typeof globalThis & { __pfInstanceSecret?: string }
const instanceSecret = (g.__pfInstanceSecret ??= randomBytes(32).toString('hex'))

const env = (name: string) => {
  const v = process.env[name]?.trim()
  return v ? v : null
}

export function getConfig(): FactoryConfig {
  const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseKey = secretEnv('SUPABASE_SECRET_KEY')
  const sanityProject = env('NEXT_PUBLIC_SANITY_PROJECT_ID')
  const sanityToken = secretEnv('SANITY_API_WRITE_TOKEN')
  const adminPassword = env('FACTORY_ADMIN_PASSWORD')
  const sessionSecret = secretEnv('SESSION_SECRET')
  const liveModels = Boolean(secretEnv('GEMINI_API_KEY') || secretEnv('GROQ_API_KEY'))
  const qaCallbackSecret = secretEnv('QA_CALLBACK_SECRET')

  return {
    siteUrl,
    liveModels,
    liveQa: liveModels && Boolean(secretEnv('GITHUB_QA_DISPATCH_TOKEN') && qaCallbackSecret),
    supabase: supabaseUrl && supabaseKey ? { url: supabaseUrl, secretKey: supabaseKey } : null,
    sanity:
      sanityProject && sanityToken
        ? {
            projectId: sanityProject,
            dataset: env('NEXT_PUBLIC_SANITY_DATASET') ?? 'production',
            demoDataset: env('SANITY_DEMO_DATASET') ?? 'demo',
            writeToken: sanityToken,
          }
        : null,
    turnstile: {
      siteKey: env('NEXT_PUBLIC_TURNSTILE_SITE_KEY'),
      secretKey: secretEnv('TURNSTILE_SECRET_KEY'),
    },
    // Admin needs both the password and a stable secret to sign the cookie.
    admin: adminPassword && sessionSecret ? { password: adminPassword, sessionSecret } : null,
    previewSecret: secretEnv('PREVIEW_SECRET') ?? instanceSecret,
    sessionSecret: sessionSecret ?? instanceSecret,
    qaCallbackSecret,
    limits: { perIpPerDay: 5, globalPerDay: 60, maxQaAttempts: 2 },
  }
}

/** Public, non-secret view of the configuration for the dashboard header. */
export interface PublicFactoryMode {
  models: 'live' | 'simulated'
  qa: 'live' | 'simulated'
  storage: 'supabase' | 'memory'
  adminEnabled: boolean
  turnstileSiteKey: string | null
  dailyCap: number
  perIpCap: number
}

export function publicMode(config: FactoryConfig = getConfig()): PublicFactoryMode {
  return {
    models: config.liveModels ? 'live' : 'simulated',
    qa: config.liveQa ? 'live' : 'simulated',
    storage: config.supabase ? 'supabase' : 'memory',
    adminEnabled: Boolean(config.admin),
    turnstileSiteKey: config.turnstile.siteKey,
    dailyCap: config.limits.globalPerDay,
    perIpCap: config.limits.perIpPerDay,
  }
}
