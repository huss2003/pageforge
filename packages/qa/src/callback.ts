import { QA_SECRET_HEADER, type QaCallbackPayload } from './index'

export interface PostCallbackOptions {
  secret: string
  /** Total attempts. Default 3. */
  attempts?: number
  /** First backoff delay; doubles each retry. Default 2 s. */
  baseDelayMs?: number
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  sleep?: (ms: number) => Promise<void>
  log?: (msg: string) => void
}

/**
 * POST the QA result to the web app. Retries network errors, 429 and 5xx
 * with exponential backoff; 4xx (bad secret, unknown run) fail immediately.
 */
export async function postCallback(
  url: string,
  payload: QaCallbackPayload,
  opts: PostCallbackOptions,
): Promise<{ ok: boolean; status?: number; attempts: number }> {
  const attempts = opts.attempts ?? 3
  const doFetch = opts.fetch ?? ((u: string, i?: RequestInit) => fetch(u, i))
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const log = opts.log ?? (() => {})
  let status: number | undefined

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [QA_SECRET_HEADER]: opts.secret },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      })
      status = res.status
      if (res.ok) return { ok: true, status, attempts: i }
      log(`callback attempt ${i} → HTTP ${res.status}`)
      if (res.status < 500 && res.status !== 429 && res.status !== 408)
        return { ok: false, status, attempts: i }
    } catch (e) {
      log(`callback attempt ${i} failed: ${(e as Error).message}`)
    }
    if (i < attempts) await sleep((opts.baseDelayMs ?? 2_000) * 2 ** (i - 1))
  }
  return { ok: false, status, attempts }
}
