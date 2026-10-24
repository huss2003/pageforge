import type { LlmClient, LlmResult } from '../types'
import { LlmError } from './errors'
import {
  DEFAULT_TIMEOUT_MS,
  parseModelJson,
  postJson,
  type FetchLike,
  type GenerateJsonOpts,
  type HttpClientOptions,
} from './shared'

/**
 * Groq via its OpenAI-compatible chat completions endpoint. Used as the
 * fallback when Gemini is rate limited or down.
 *
 * Uses JSON object mode rather than `json_schema`: strict json_schema
 * requires every field to be required (our block schemas have optional
 * fields), and sending the full page schema costs tokens against the free
 * tier's 8K tokens-per-minute budget. The prompt already describes the shape
 * compactly and zod validates the result.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export interface GroqOptions extends HttpClientOptions {
  /** For reasoning models (gpt-oss): keeps hidden reasoning tokens low. */
  reasoningEffort?: 'low' | 'medium' | 'high'
  maxCompletionTokens?: number
}

interface ChatCompletion {
  model?: string
  choices?: { message?: { content?: string | null }; finish_reason?: string }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

export class GroqClient implements LlmClient {
  readonly provider = 'groq'
  readonly model: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly fetchImpl: FetchLike
  private readonly reasoningEffort: GroqOptions['reasoningEffort']
  private readonly maxCompletionTokens: number

  constructor(opts: GroqOptions) {
    this.apiKey = opts.apiKey
    this.model = opts.model || DEFAULT_GROQ_MODEL
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init))
    this.reasoningEffort = opts.reasoningEffort ?? 'low'
    this.maxCompletionTokens = opts.maxCompletionTokens ?? 8_192
  }

  async generateJson<T>(opts: GenerateJsonOpts<T>): Promise<LlmResult<T>> {
    const reasoning = /gpt-oss|qwen3/.test(this.model)
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: `${opts.prompt}\n\nRespond with one JSON object only.` },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: this.maxCompletionTokens,
      temperature: opts.temperature ?? 0.4,
    }
    if (reasoning) {
      body.reasoning_effort = this.reasoningEffort
      body.include_reasoning = false
    }

    const json = (await postJson(
      GROQ_ENDPOINT,
      { headers: { authorization: `Bearer ${this.apiKey}` }, body },
      {
        provider: this.provider,
        model: this.model,
        timeoutMs: this.timeoutMs,
        fetch: this.fetchImpl,
      },
    )) as ChatCompletion

    const tokens = json.usage
      ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
      : undefined
    const text = json.choices?.[0]?.message?.content
    if (!text) {
      throw new LlmError({
        kind: 'invalid-json',
        provider: this.provider,
        model: this.model,
        message: `Groq returned no content (${json.choices?.[0]?.finish_reason ?? 'empty'})`,
        tokens,
      })
    }
    const data = parseModelJson(text, opts.schema, {
      provider: this.provider,
      model: this.model,
      tokens,
    })
    return { data, model: this.model, tokens }
  }
}
