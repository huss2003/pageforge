import { z } from 'zod'
import { LlmError, kindFromStatus } from './errors'

export const DEFAULT_TIMEOUT_MS = 25_000

export interface GenerateJsonOpts<T> {
  system: string
  prompt: string
  schema: z.ZodType<T>
  task: string
  temperature?: number
  /**
   * Ask the provider to constrain decoding to the schema (default true).
   * Large union schemas make constrained decoding slow on some models; with
   * false the model is asked for plain JSON and zod still checks the result.
   */
  constrained?: boolean
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface HttpClientOptions {
  apiKey: string
  model?: string
  /** Per-request timeout. Default 25 s. */
  timeoutMs?: number
  /** Injected for tests; defaults to global fetch. */
  fetch?: FetchLike
}

/** Format zod issues as short "path: message" strings the model can act on. */
export function formatIssues(error: z.ZodError, max = 20): string[] {
  return error.issues.slice(0, max).map((i) => {
    const path = i.path.length ? i.path.join('.') : '(root)'
    return `${path}: ${i.message}`
  })
}

/** Strip code fences / prose around a JSON object and parse it. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1])
    } catch {
      // fall through
    }
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
  throw new SyntaxError('No JSON object found in model output')
}

/** Parse model text into T, raising typed errors for the fallback logic. */
export function parseModelJson<T>(
  text: string,
  schema: z.ZodType<T>,
  ctx: { provider: string; model: string; tokens?: { input: number; output: number } },
): T {
  let raw: unknown
  try {
    raw = extractJson(text)
  } catch (cause) {
    throw new LlmError({
      kind: 'invalid-json',
      provider: ctx.provider,
      model: ctx.model,
      message: `${ctx.provider} returned text that is not JSON`,
      tokens: ctx.tokens,
      cause,
    })
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issues = formatIssues(parsed.error)
    throw new LlmError({
      kind: 'schema',
      provider: ctx.provider,
      model: ctx.model,
      message: `${ctx.provider} output did not match the schema: ${issues.slice(0, 3).join('; ')}`,
      raw,
      issues,
      tokens: ctx.tokens,
    })
  }
  return parsed.data
}

/**
 * JSON Schema for the model's response. Uses the *input* side of the zod
 * schema so fields with defaults stay optional for the model.
 */
export function toModelJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >
  delete json.$schema
  return json
}

/** fetch with an AbortSignal timeout, mapping failures to LlmError. */
export async function postJson(
  url: string,
  init: { headers: Record<string, string>; body: unknown },
  ctx: { provider: string; model: string; timeoutMs: number; fetch: FetchLike },
): Promise<unknown> {
  let res: Response
  try {
    res = await ctx.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...init.headers },
      body: JSON.stringify(init.body),
      signal: AbortSignal.timeout(ctx.timeoutMs),
    })
  } catch (cause) {
    const name = (cause as { name?: string } | null)?.name
    const timedOut = name === 'TimeoutError' || name === 'AbortError'
    throw new LlmError({
      kind: timedOut ? 'timeout' : 'network',
      provider: ctx.provider,
      model: ctx.model,
      message: timedOut
        ? `${ctx.provider} timed out after ${ctx.timeoutMs} ms`
        : `${ctx.provider} request failed: ${(cause as Error)?.message ?? String(cause)}`,
      cause,
    })
  }

  const text = await res.text()
  if (!res.ok) {
    // Google answers a bad API key with 400 INVALID_ARGUMENT, not 401.
    const authLike = /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|invalid_api_key/i.test(
      text,
    )
    throw new LlmError({
      kind: authLike ? 'auth' : kindFromStatus(res.status),
      provider: ctx.provider,
      model: ctx.model,
      status: res.status,
      retryAfterMs: retryAfterMs(res, text),
      message: `${ctx.provider} HTTP ${res.status}: ${errorMessage(text)}`,
    })
  }
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw new LlmError({
      kind: 'server',
      provider: ctx.provider,
      model: ctx.model,
      status: res.status,
      message: `${ctx.provider} returned a non-JSON HTTP body`,
      cause,
    })
  }
}

function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string }
    const msg = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message
    if (msg) return msg.slice(0, 300)
  } catch {
    // ignore
  }
  return body.slice(0, 300) || 'no body'
}

function retryAfterMs(res: Response, body: string): number | undefined {
  const header = res.headers.get('retry-after')
  if (header) {
    const secs = Number(header)
    if (Number.isFinite(secs)) return secs * 1000
  }
  // Gemini: error.details[].retryDelay = "17s"
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body)
  return m?.[1] ? Math.round(Number(m[1]) * 1000) : undefined
}
