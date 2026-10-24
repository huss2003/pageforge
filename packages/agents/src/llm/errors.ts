/**
 * Typed errors for model calls. `kind` drives the fallback decision:
 * transport problems (rate limit, 5xx, timeout, network, unparseable JSON)
 * switch to the next provider; a well-formed answer with the wrong shape
 * ("schema") does not, because the writer's retry loop can feed the exact
 * validation errors back to the model, which fixes it more reliably.
 */
export type LlmErrorKind =
  | 'rate-limit'
  | 'server'
  | 'timeout'
  | 'network'
  | 'invalid-json'
  | 'schema'
  | 'auth'
  | 'bad-request'

export class LlmError extends Error {
  readonly kind: LlmErrorKind
  readonly provider: string
  readonly model: string
  readonly status?: number
  /** Parsed JSON when the model answered but the shape did not match the schema. */
  readonly raw?: unknown
  /** Zod issue messages for `schema` errors, prefixed with their path. */
  readonly issues?: string[]
  /** Suggested wait before calling this provider again (from Retry-After / RetryInfo). */
  readonly retryAfterMs?: number
  readonly tokens?: { input: number; output: number }

  constructor(opts: {
    kind: LlmErrorKind
    provider: string
    model: string
    message: string
    status?: number
    raw?: unknown
    issues?: string[]
    retryAfterMs?: number
    tokens?: { input: number; output: number }
    cause?: unknown
  }) {
    super(opts.message, opts.cause === undefined ? undefined : { cause: opts.cause })
    this.name = 'LlmError'
    this.kind = opts.kind
    this.provider = opts.provider
    this.model = opts.model
    this.status = opts.status
    this.raw = opts.raw
    this.issues = opts.issues
    this.retryAfterMs = opts.retryAfterMs
    this.tokens = opts.tokens
  }
}

export function isLlmError(e: unknown): e is LlmError {
  return e instanceof LlmError
}

/** Errors worth retrying on another provider. */
export function shouldFallback(e: unknown): boolean {
  if (!isLlmError(e)) return true
  return e.kind !== 'schema'
}

export function kindFromStatus(status: number): LlmErrorKind {
  if (status === 429) return 'rate-limit'
  if (status === 401 || status === 403) return 'auth'
  if (status === 408) return 'timeout'
  if (status >= 500) return 'server'
  return 'bad-request'
}
