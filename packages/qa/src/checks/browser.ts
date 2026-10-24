import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { chromium, devices } from 'playwright'
import {
  browserScript,
  mapTargetsToBlockKeys,
  visualChecks,
  type TargetRequest,
  type VisualFinding,
} from '../dom-map'
import type { AxeViolationLike, LhrLike } from '../issues'
import { targetRequests } from '../issues'

export interface BrowserCheckOptions {
  chromePath?: string
  screenshotPath: string
  /** Lighthouse result whose node paths should be traced to block keys. */
  lhr?: LhrLike
  timeoutMs?: number
}

export interface BrowserCheckResult {
  violations: AxeViolationLike[]
  keyMap: Record<string, string | null>
  visual: VisualFinding[]
  screenshotPath: string
  /** Number of elements tagged with data-block-key (0 means mapping is impossible). */
  taggedBlocks: number
}

/** Mobile profile close to Lighthouse's default (Moto G Power, 412×823). */
const MOBILE = {
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
}

/**
 * axe-core (WCAG 2.x A/AA + best-practice rules), block-key mapping,
 * layout checks and a full-page screenshot, in one Chromium session.
 */
export async function runBrowserChecks(
  url: string,
  opts: BrowserCheckOptions,
): Promise<BrowserCheckResult> {
  const browser = await chromium.launch({
    executablePath: opts.chromePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const context = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(opts.timeoutMs ?? 45_000)
    const res = await page.goto(url, { waitUntil: 'networkidle' })
    if (!res || !res.ok())
      throw new Error(`Preview responded ${res?.status() ?? 'without a response'} for ${url}`)
    await page.evaluate(() => document.fonts.ready)

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    const violations = axe.violations as unknown as AxeViolationLike[]

    const requests: TargetRequest[] = targetRequests(opts.lhr, violations)
    const keyMap = (await page.evaluate(
      browserScript(
        [mapTargetsToBlockKeys],
        `mapTargetsToBlockKeys(document, ${JSON.stringify(requests)})`,
      ),
    )) as Record<string, string | null>
    const visual = (await page.evaluate(
      browserScript([visualChecks], 'visualChecks(document, window)'),
    )) as VisualFinding[]
    const taggedBlocks = await page.locator('[data-block-key]').count()

    await mkdir(dirname(opts.screenshotPath), { recursive: true })
    await page.screenshot({ path: opts.screenshotPath, fullPage: true, animations: 'disabled' })
    await context.close()
    return { violations, keyMap, visual, screenshotPath: opts.screenshotPath, taggedBlocks }
  } finally {
    await browser.close()
  }
}
