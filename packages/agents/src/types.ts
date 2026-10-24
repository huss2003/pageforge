import type { z } from 'zod'

export interface LlmResult<T> {
  data: T
  model: string
  tokens?: { input: number; output: number }
}

/**
 * Minimal model interface. Implementations: Gemini (primary), Groq
 * (fallback on 429/5xx), and a deterministic fake for tests and keyless demos.
 */
export interface LlmClient {
  generateJson<T>(opts: {
    system: string
    prompt: string
    schema: z.ZodType<T>
    /** Name used in logs and by the fake model, e.g. "abm-draft". */
    task: string
    temperature?: number
    /** Constrain decoding to the schema where the provider supports it (default true). */
    constrained?: boolean
  }): Promise<LlmResult<T>>
}
