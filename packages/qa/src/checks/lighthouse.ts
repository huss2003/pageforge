import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import type { LhrLike } from '../issues'

export interface LighthouseOptions {
  chromePath?: string
  /** Lighthouse default is mobile emulation with simulated throttling. */
  formFactor?: 'mobile' | 'desktop'
  timeoutMs?: number
}

/**
 * Audits skipped on purpose:
 * - is-crawlable: draft previews and prospect landing pages are noindex by
 *   design, and this audit alone would cap the SEO score far below 95.
 */
export const SKIPPED_AUDITS = ['is-crawlable']

export async function runLighthouse(url: string, opts: LighthouseOptions = {}): Promise<LhrLike> {
  const chrome = await chromeLauncher.launch({
    chromePath: opts.chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    logLevel: 'error',
  })
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      skipAudits: SKIPPED_AUDITS,
      formFactor: opts.formFactor ?? 'mobile',
      maxWaitForLoad: opts.timeoutMs ?? 45_000,
      ...(opts.formFactor === 'desktop'
        ? {
            screenEmulation: {
              mobile: false,
              width: 1350,
              height: 940,
              deviceScaleFactor: 1,
              disabled: false,
            },
          }
        : {}),
    })
    if (!result) throw new Error('Lighthouse returned no result')
    const lhr = result.lhr
    if (lhr.runtimeError)
      throw new Error(`Lighthouse: ${lhr.runtimeError.code} ${lhr.runtimeError.message}`)
    return lhr as unknown as LhrLike
  } finally {
    await chrome.kill()
  }
}
