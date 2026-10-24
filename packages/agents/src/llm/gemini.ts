import type { LlmClient, LlmResult } from '../types'
import { LlmError, isLlmError } from './errors'
import {
  DEFAULT_TIMEOUT_MS,
  parseModelJson,
  postJson,
  toModelJsonSchema,
  type FetchLike,
  type GenerateJsonOpts,
  type HttpClientOptions,
} from './shared'

/**
 * Google Gemini via the REST `generateContent` endpoint (no SDK, works on
 * Node 22 and Vercel functions).
 *
 * Structured output: the response schema is sent as
 * `generationConfig.responseFormat.text` ({ mimeType: APPLICATION_JSON, schema }),
 * the replacement for the deprecated `responseSchema`/`_responseJsonSchema`
 * fields. Gemini ignores length keywords, so zod still validates the result.
 * If the API rejects the schema (HTTP 400, e.g. too complex), the call is
 * repeated once in plain JSON mode with the shape described in the prompt.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface GeminiOptions extends HttpClientOptions {
  /** Gemini 3+ thinking depth. "low" keeps latency and token use down. */
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'
  maxOutputTokens?: number
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] }
    finishReason?: string
  }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
  }
  modelVersion?: string
}

export class GeminiClient implements LlmClient {
  readonly provider = 'gemini'
  readonly model: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly fetchImpl: FetchLike
  private readonly thinkingLevel: GeminiOptions['thinkingLevel']
  private readonly maxOutputTokens: number

  constructor(opts: GeminiOptions) {
    this.apiKey = opts.apiKey
    this.model = opts.model || DEFAULT_GEMINI_MODEL
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init))
    this.thinkingLevel = opts.thinkingLevel ?? 'low'
    this.maxOutputTokens = opts.maxOutputTokens ?? 16_384
  }

  async generateJson<T>(opts: GenerateJsonOpts<T>): Promise<LlmResult<T>> {
    const schema = opts.schema
    let json: GeminiResponse
    try {
      json = await this.call(
        opts,
        opts.constrained === false ? undefined : geminiSchema(toModelJsonSchema(schema)),
      )
    } catch (e) {
      // A rejected schema, or a server error while decoding against it, is
      // worth one more call in plain JSON mode; zod checks the result anyway.
      if (
        opts.constrained !== false &&
        isLlmError(e) &&
        ((e.kind === 'bad-request' && /schema|response_?format|responseFormat/i.test(e.message)) ||
          e.kind === 'server')
      ) {
        json = await this.call(opts, undefined)
      } else {
        throw e
      }
    }

    const usage = json.usageMetadata
    const tokens = usage
      ? {
          input: usage.promptTokenCount ?? 0,
          output: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
        }
      : undefined
    const candidate = json.candidates?.[0]
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')

    if (!text) {
      const reason = json.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'empty response'
      throw new LlmError({
        kind: 'invalid-json',
        provider: this.provider,
        model: this.model,
        message: `Gemini returned no text (${reason})`,
        tokens,
      })
    }
    const data = parseModelJson(text, schema, {
      provider: this.provider,
      model: this.model,
      tokens,
    })
    return { data, model: this.model, tokens }
  }

  private async call(
    opts: GenerateJsonOpts<unknown>,
    schema: Record<string, unknown> | undefined,
  ): Promise<GeminiResponse> {
    const isGemini2 = /^gemini-(1|2)\./.test(this.model)
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: this.maxOutputTokens,
    }
    if (schema) {
      generationConfig.responseFormat = { text: { mimeType: 'APPLICATION_JSON', schema } }
    } else {
      generationConfig.responseMimeType = 'application/json'
    }
    if (isGemini2) {
      // Gemini 3 recommends the default temperature (1.0); older models get the caller's.
      if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature
    } else if (this.thinkingLevel) {
      generationConfig.thinkingConfig = { thinkingLevel: this.thinkingLevel.toUpperCase() }
    }

    const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`
    return (await postJson(
      url,
      {
        headers: { 'x-goog-api-key': this.apiKey },
        body: {
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
          generationConfig,
        },
      },
      {
        provider: this.provider,
        model: this.model,
        timeoutMs: this.timeoutMs,
        fetch: this.fetchImpl,
      },
    )) as GeminiResponse
  }
}

const DROP_KEYS = new Set(['default', 'minLength', 'maxLength', 'pattern', '$schema'])

/**
 * Reduce a zod-generated JSON Schema to the subset Gemini supports:
 * `const` → single-value `enum`, `oneOf` → `anyOf`, unsupported keywords
 * dropped (zod re-checks them after the call).
 */
export function geminiSchema(node: unknown): Record<string, unknown> {
  return walk(node) as Record<string, unknown>
  function walk(n: unknown): unknown {
    if (Array.isArray(n)) return n.map(walk)
    if (!n || typeof n !== 'object') return n
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(n)) {
      if (DROP_KEYS.has(k)) continue
      if (k === 'const') {
        out.enum = [v]
      } else if (k === 'oneOf') {
        out.anyOf = walk(v)
      } else if (k === 'properties' && v && typeof v === 'object') {
        out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, walk(pv)]))
      } else {
        out[k] = walk(v)
      }
    }
    return out
  }
}
