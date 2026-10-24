import type { BrandFacts } from '@pageforge/content'
import type { LlmClient } from '../types'
import { FallbackLlm, type NamedLlm } from './fallback'
import { FakeLlm } from './fake'
import { DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_MODELS, GeminiClient } from './gemini'
import { DEFAULT_GROQ_MODEL, GroqClient } from './groq'
import type { FetchLike } from './shared'

export * from './errors'
export { FallbackLlm, type FallbackAttempt, type NamedLlm } from './fallback'
export { FakeLlm, FAKE_MODEL, type FakeLlmOptions } from './fake'
export {
  GeminiClient,
  DEFAULT_GEMINI_MODEL,
  GEMINI_ENDPOINT,
  geminiSchema,
  type GeminiOptions,
} from './gemini'
export { GroqClient, DEFAULT_GROQ_MODEL, GROQ_ENDPOINT, type GroqOptions } from './groq'
export { DEFAULT_TIMEOUT_MS, extractJson, type FetchLike, type GenerateJsonOpts } from './shared'

/** Env names match .env.example. */
export interface LlmEnv {
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  GROQ_API_KEY?: string
  GROQ_MODEL?: string
  [key: string]: string | undefined
}

export interface EnvLlm {
  llm: LlmClient
  /** True when no API key is set and the deterministic FakeLlm is used. */
  simulated: boolean
  /** Model ids in fallback order, e.g. ["gemini-3.5-flash-lite", "openai/gpt-oss-120b"]. */
  models: string[]
}

export interface CreateLlmOptions {
  /** Brand facts for simulation mode (FakeLlm composes copy from them). */
  facts: BrandFacts
  timeoutMs?: number
  fetch?: FetchLike
  /** Delay per simulated call, for a believable demo timeline. */
  simulatedLatencyMs?: number
}

/**
 * Gemini → Groq fallback when both keys exist, a single client when only one
 * does, otherwise the offline FakeLlm (`simulated: true`).
 */
export function createLlmFromEnv(env: LlmEnv, opts: CreateLlmOptions): EnvLlm {
  const clients: NamedLlm[] = []
  const common = { timeoutMs: opts.timeoutMs, fetch: opts.fetch }
  // Keys never contain whitespace; strip any that a wrapped paste added.
  const geminiKey = env.GEMINI_API_KEY?.replace(/\s+/g, '')
  const groqKey = env.GROQ_API_KEY?.replace(/\s+/g, '')
  if (geminiKey) {
    // GEMINI_MODEL may list several models, tried in order: each has its own
    // free-tier quota, so a busy model ("high demand") falls back to the next.
    const models = (env.GEMINI_MODEL ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
    for (const model of models.length ? models : DEFAULT_GEMINI_MODELS) {
      clients.push(new GeminiClient({ ...common, apiKey: geminiKey, model }))
    }
  }
  if (groqKey) {
    clients.push(
      new GroqClient({
        ...common,
        apiKey: groqKey,
        model: env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
      }),
    )
  }
  if (clients.length === 0) {
    const fake = new FakeLlm(opts.facts, { latencyMs: opts.simulatedLatencyMs })
    return { llm: fake, simulated: true, models: [fake.model] }
  }
  const llm = clients.length === 1 ? clients[0]! : new FallbackLlm(clients)
  return { llm, simulated: false, models: clients.map((c) => c.model) }
}
