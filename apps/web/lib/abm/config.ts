import { randomBytes } from 'node:crypto'
import { secretEnv } from '@/lib/env'
import { siteUrl } from '@/lib/site'
import type { AbmMode } from './types'

/**
 * ABM configuration, read from the environment on every call so tests can
 * change process.env between cases. Every value is optional: with no keys
 * the tool runs end to end in simulation mode with an in-memory store.
 */
export interface AbmConfig {
  siteUrl: string
  liveModels: boolean
  supabase: boolean
  /** Workspace password for the main workspace (FACTORY_ADMIN_PASSWORD). */
  adminPassword: string | null
  sessionSecret: string
  turnstile: { siteKey: string | null; secretKey: string | null }
  hubspotToken: string | null
  /** Loopback sources are allowed outside production, or with ABM_ALLOW_LOCAL_SOURCES=1. */
  allowLocalSources: boolean
  limits: {
    draftsPerIpPerDay: number
    draftsPerDay: number
    eventsPerVisitorPerMinute: number
    leadsPerIpPerDay: number
    meetingsPerIpPerDay: number
  }
}

/** Per-instance fallback for SESSION_SECRET (sessions then live on one instance only). */
const g = globalThis as typeof globalThis & { __pfAbmInstanceSecret?: string }
const instanceSecret = (g.__pfAbmInstanceSecret ??= randomBytes(32).toString('hex'))

const env = (name: string) => process.env[name]?.trim() || null

export function getAbmConfig(): AbmConfig {
  return {
    siteUrl,
    liveModels: Boolean(secretEnv('GEMINI_API_KEY') || secretEnv('GROQ_API_KEY')),
    supabase: Boolean(env('NEXT_PUBLIC_SUPABASE_URL') && secretEnv('SUPABASE_SECRET_KEY')),
    adminPassword: env('FACTORY_ADMIN_PASSWORD'),
    sessionSecret: secretEnv('SESSION_SECRET') ?? instanceSecret,
    turnstile: {
      siteKey: env('NEXT_PUBLIC_TURNSTILE_SITE_KEY'),
      secretKey: secretEnv('TURNSTILE_SECRET_KEY'),
    },
    hubspotToken: secretEnv('HUBSPOT_PRIVATE_APP_TOKEN'),
    allowLocalSources:
      process.env.NODE_ENV !== 'production' || env('ABM_ALLOW_LOCAL_SOURCES') === '1',
    limits: {
      draftsPerIpPerDay: 5,
      draftsPerDay: 60,
      eventsPerVisitorPerMinute: 120,
      leadsPerIpPerDay: 5,
      meetingsPerIpPerDay: 5,
    },
  }
}

export function abmMode(config: AbmConfig = getAbmConfig()): AbmMode {
  return {
    models: config.liveModels ? 'live' : 'simulated',
    storage: config.supabase ? 'supabase' : 'memory',
    crm: config.hubspotToken ? 'hubspot' : 'builtin',
    workspacePasswordEnabled: Boolean(config.adminPassword),
    turnstileSiteKey: config.turnstile.siteKey,
    limits: {
      draftsPerIpPerDay: config.limits.draftsPerIpPerDay,
      draftsPerDay: config.limits.draftsPerDay,
    },
  }
}
