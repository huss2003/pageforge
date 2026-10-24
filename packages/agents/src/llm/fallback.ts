import type { LlmClient, LlmResult } from '../types'
import { LlmError, isLlmError, shouldFallback } from './errors'
import type { GenerateJsonOpts } from './shared'

export interface NamedLlm extends LlmClient {
  readonly provider: string
  readonly model: string
}

export interface FallbackAttempt {
  provider: string
  model: string
  ok: boolean
  error?: string
  kind?: string
  /** Wall-clock time of this attempt. */
  ms?: number
}

/**
 * Tries each client in order. Rate limits, 5xx, timeouts, network errors and
 * unparseable JSON move on to the next client; a schema mismatch is returned
 * to the caller (the writer's retry loop handles it with targeted feedback).
 *
 * A client that answered 429 is skipped until its Retry-After passes, so a
 * run does not waste its next call on a provider known to be throttled.
 */
export class FallbackLlm implements LlmClient {
  readonly clients: NamedLlm[]
  /** Attempts made by the most recent `generateJson` call. */
  lastAttempts: FallbackAttempt[] = []
  private readonly cooldownUntil = new Map<NamedLlm, number>()
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  /** Pause before retrying a provider that answered 5xx ("high demand"). */
  readonly retryDelayMs: number

  constructor(
    clients: NamedLlm[],
    opts: { now?: () => number; sleep?: (ms: number) => Promise<void>; retryDelayMs?: number } = {},
  ) {
    if (clients.length === 0) throw new Error('FallbackLlm needs at least one client')
    this.clients = clients
    this.now = opts.now ?? (() => Date.now())
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.retryDelayMs = opts.retryDelayMs ?? 2500
  }

  get model(): string {
    return this.clients.map((c) => c.model).join(' → ')
  }

  get provider(): string {
    return 'fallback'
  }

  async generateJson<T>(opts: GenerateJsonOpts<T>): Promise<LlmResult<T>> {
    this.lastAttempts = []
    const now = this.now()
    const ready = this.clients.filter((c) => (this.cooldownUntil.get(c) ?? 0) <= now)
    // If every client is cooling down, try them all anyway rather than fail.
    const order = ready.length ? ready : this.clients
    let lastError: unknown

    for (const client of order) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const started = Date.now()
        try {
          const result = await client.generateJson(opts)
          this.lastAttempts.push({
            provider: client.provider,
            model: result.model,
            ok: true,
            ms: Date.now() - started,
          })
          return result
        } catch (e) {
          lastError = e
          this.lastAttempts.push({
            provider: client.provider,
            model: client.model,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
            kind: isLlmError(e) ? e.kind : undefined,
            ms: Date.now() - started,
          })
          if (isLlmError(e) && e.kind === 'rate-limit') {
            this.cooldownUntil.set(client, this.now() + (e.retryAfterMs ?? 60_000))
          }
          if (!shouldFallback(e)) throw e
          // A 5xx is usually a short spike: one more try on the same model.
          if (attempt === 0 && isLlmError(e) && e.kind === 'server') {
            await this.sleep(this.retryDelayMs)
            continue
          }
          break
        }
      }
    }
    if (lastError instanceof LlmError) throw lastError
    throw new LlmError({
      kind: 'server',
      provider: 'fallback',
      model: this.model,
      message: `All models failed: ${this.lastAttempts.map((a) => `${a.model}: ${a.error}`).join(' | ')}`,
      cause: lastError,
    })
  }
}
