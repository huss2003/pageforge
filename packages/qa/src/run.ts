/**
 * QA CLI — runs in GitHub Actions against a draft preview URL.
 *
 *   tsx src/run.ts --url <preview> [--run-id <uuid>] [--attempt <n>]
 *                  [--callback <url>] [--out-dir qa-output] [--desktop]
 *
 * Writes <out-dir>/result.json and <out-dir>/screenshot.png, prints the
 * QaRunOutput JSON to stdout, and (with --callback + QA_CALLBACK_SECRET)
 * POSTs it to the web app. Exit code: 0 passed, 1 failed thresholds, 2 crashed.
 *
 * Env: QA_CALLBACK_SECRET, CHROME_PATH (optional Chromium binary),
 * GITHUB_SERVER_URL / GITHUB_REPOSITORY / GITHUB_RUN_ID (set by Actions).
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { postCallback } from './callback'
import { runBrowserChecks } from './checks/browser'
import { runLighthouse } from './checks/lighthouse'
import { computePassed, type QaCallbackPayload, type QaRunOutput } from './index'
import { axeCounts, buildIssues, lighthouseScores, type LhrLike } from './issues'

const log = (msg: string) => process.stderr.write(`[qa] ${msg}\n`)

function chromePath(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  try {
    const p = chromium.executablePath()
    return existsSync(p) ? p : undefined
  } catch {
    return undefined
  }
}

export async function runQa(opts: {
  url: string
  runId?: string
  attempt?: number
  outDir: string
  desktop?: boolean
}): Promise<QaRunOutput> {
  const started = Date.now()
  const startedAt = new Date(started).toISOString()
  const screenshotPath = resolve(opts.outDir, 'screenshot.png')
  const chrome = chromePath()
  log(`url ${opts.url}${chrome ? ` · chrome ${chrome}` : ''}`)

  let lhr: LhrLike | undefined
  try {
    log('lighthouse…')
    lhr = await runLighthouse(opts.url, {
      chromePath: chrome,
      formFactor: opts.desktop ? 'desktop' : 'mobile',
    })
    const s = lighthouseScores(lhr)
    log(
      `scores perf ${s.performance} · a11y ${s.accessibility} · seo ${s.seo} · bp ${s.bestPractices}`,
    )

    log('axe + screenshot…')
    const b = await runBrowserChecks(opts.url, { chromePath: chrome, screenshotPath, lhr })
    if (b.taggedBlocks === 0)
      log('warning: no [data-block-key] elements; issues cannot be traced to blocks')
    const issues = [
      ...buildIssues({ lhr, violations: b.violations, keyMap: b.keyMap }),
      ...b.visual.map((v) => ({
        source: 'visual' as const,
        id: v.id,
        message: v.message,
        blockKey: v.blockKey,
      })),
    ]
    const counts = axeCounts(b.violations)
    log(`axe violations ${JSON.stringify(counts)} · ${issues.length} issues`)

    return {
      url: opts.url,
      runId: opts.runId,
      attempt: opts.attempt,
      scores: s,
      issues,
      passed: computePassed(
        s,
        b.violations.map((v) => v.impact),
      ),
      startedAt,
      durationMs: Date.now() - started,
      screenshotPath: b.screenshotPath,
      axeCounts: counts,
      lighthouseVersion: lhr.lighthouseVersion,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log(`crashed: ${message}`)
    return {
      url: opts.url,
      runId: opts.runId,
      attempt: opts.attempt,
      scores: lhr
        ? lighthouseScores(lhr)
        : { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 },
      issues: [{ source: 'visual', id: 'qa-crashed', message: message.slice(0, 500) }],
      passed: false,
      startedAt,
      durationMs: Date.now() - started,
      error: message,
    }
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      'run-id': { type: 'string' },
      attempt: { type: 'string', default: '1' },
      callback: { type: 'string' },
      'out-dir': { type: 'string', default: 'qa-output' },
      desktop: { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (!values.url || !/^https?:\/\//.test(values.url)) {
    log(
      'usage: run.ts --url <http(s) preview url> [--run-id id] [--attempt n] [--callback url] [--out-dir dir]',
    )
    process.exit(2)
  }
  const attempt = Number.parseInt(values.attempt ?? '1', 10) || 1
  const outDir = resolve(values['out-dir'] ?? 'qa-output')
  await mkdir(outDir, { recursive: true })

  const result = await runQa({
    url: values.url,
    runId: values['run-id'],
    attempt,
    outDir,
    desktop: values.desktop,
  })
  await writeFile(resolve(outDir, 'result.json'), JSON.stringify(result, null, 2))
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)

  const secret = process.env.QA_CALLBACK_SECRET
  if (values.callback) {
    if (!secret) {
      log('--callback given but QA_CALLBACK_SECRET is not set; skipping callback')
    } else if (!values['run-id']) {
      log('--callback needs --run-id; skipping callback')
    } else {
      const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env
      const workflowRunUrl =
        GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
          ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
          : undefined
      const payload: QaCallbackPayload = {
        ...result,
        runId: values['run-id'],
        attempt,
        workflowRunUrl,
        // The screenshot is uploaded as a workflow artifact, listed on the run page.
        screenshotUrl: workflowRunUrl ? `${workflowRunUrl}#artifacts` : undefined,
      }
      const r = await postCallback(values.callback, payload, { secret, log })
      log(
        r.ok
          ? `callback delivered (HTTP ${r.status})`
          : `callback failed after ${r.attempts} attempts (HTTP ${r.status ?? '-'})`,
      )
      if (!r.ok) process.exitCode = 2
    }
  }
  if (process.exitCode === undefined) process.exitCode = result.error ? 2 : result.passed ? 0 : 1
}

const invokedDirectly = process.argv[1] && /run\.(ts|js|mjs)$/.test(process.argv[1])
if (invokedDirectly || process.env.PAGEFORGE_QA_CLI === '1') {
  main().catch((e: unknown) => {
    log(`fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
    process.exit(2)
  })
}
