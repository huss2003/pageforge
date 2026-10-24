/**
 * Starts the QA workflow in GitHub Actions. Used by the web app on Vercel:
 * fetch only, no Node-only dependencies, never imports Lighthouse/Playwright.
 *
 * Env: GITHUB_QA_DISPATCH_TOKEN (fine-grained PAT, Actions read+write on the
 * repo), GITHUB_REPOSITORY ("owner/repo").
 */
export const QA_WORKFLOW_FILE = 'qa-run.yml'

export interface DispatchQaRunInput {
  runId: string
  /** Draft preview URL the workflow will test. */
  url: string
  attempt: number
  /** Where the workflow POSTs the QaCallbackPayload. */
  callbackUrl: string
}

export interface DispatchQaRunOptions {
  token?: string
  repository?: string
  /** Git ref holding the workflow file. Default "main". */
  ref?: string
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  /** Default 10 s. */
  timeoutMs?: number
}

export interface DispatchQaRunResult {
  /** Present when GitHub returns run details (API 2026-03-10+). */
  workflowRunId?: number
  htmlUrl?: string
}

export class QaDispatchError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'QaDispatchError'
    this.status = status
  }
}

function env(name: string): string | undefined {
  // `process` is absent in edge/browser runtimes.
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  // Tokens never contain whitespace; strip any that a wrapped paste added.
  return p?.env?.[name]?.replace(/\s+/g, '') || undefined
}

export async function dispatchQaRun(
  input: DispatchQaRunInput,
  opts: DispatchQaRunOptions = {},
): Promise<DispatchQaRunResult> {
  const token = opts.token ?? env('GITHUB_QA_DISPATCH_TOKEN')
  const repository = opts.repository ?? env('GITHUB_REPOSITORY')
  if (!token) throw new QaDispatchError('GITHUB_QA_DISPATCH_TOKEN is not set')
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new QaDispatchError('GITHUB_REPOSITORY must look like "owner/repo"')
  }
  for (const [name, value] of [
    ['url', input.url],
    ['callbackUrl', input.callbackUrl],
  ] as const) {
    if (!/^https?:\/\//.test(value)) throw new QaDispatchError(`${name} must be an http(s) URL`)
  }

  const doFetch = opts.fetch ?? ((u: string, i?: RequestInit) => fetch(u, i))
  const res = await doFetch(
    `https://api.github.com/repos/${repository}/actions/workflows/${QA_WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2026-03-10',
        'user-agent': 'pageforge-qa-dispatch',
      },
      body: JSON.stringify({
        ref: opts.ref ?? 'main',
        // workflow_dispatch inputs are strings.
        inputs: {
          run_id: input.runId,
          url: input.url,
          attempt: String(input.attempt),
          callback_url: input.callbackUrl,
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    },
  )
  if (res.status === 204) return {}
  const text = await res.text()
  if (!res.ok) {
    let message = text.slice(0, 300)
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? message
    } catch {
      // keep raw text
    }
    throw new QaDispatchError(`GitHub dispatch failed (${res.status}): ${message}`, res.status)
  }
  try {
    const body = JSON.parse(text) as { workflow_run_id?: number; html_url?: string }
    return { workflowRunId: body.workflow_run_id, htmlUrl: body.html_url }
  } catch {
    return {}
  }
}
