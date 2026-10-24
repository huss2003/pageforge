import type { Block, Page } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import type { QaIssue, QaResult } from '@pageforge/qa'
import { GENERIC_LINK_LABELS, GOAL_CTAS } from './goals'
import { isLlmError } from './llm/errors'
import { createStepRecorder } from './pipeline'
import { fixerPrompt } from './prompts'
import { fixerOutputSchema } from './schemas'
import { clip, clipSentences, norm } from './text'
import type { Brief, FixPage } from './types'
import { validatePage } from './validator'
import { mergeBlocks } from './writer'

/**
 * QA issue ids the fixer understands. `visual` ids come from the QA CLI's
 * own layout checks; the rest are Lighthouse audit / axe rule ids.
 */
export const FIXABLE = {
  /** Fixed in code, no model call. */
  deterministic: new Set([
    'link-text',
    'link-name',
    'heading-wrap',
    'heading-too-long',
    'block-too-tall',
    'text-too-long',
  ]),
  /** Need rewriting: only the affected blocks are sent to the model. */
  rewrite: new Set(['horizontal-overflow', 'text-overflow', 'duplicate-heading', 'readability']),
}

/** Target sizes used by the deterministic fixes. */
export const FIX_LIMITS = { heading: 60, bodyRatio: 0.7 }

type Goal = Brief['goal']

/** Recover the brief goal from a page: closing block and CTA target. */
export function inferGoal(page: Page): Goal | undefined {
  const last = page.blocks[page.blocks.length - 1]
  if (last?._type === 'demoForm') return 'book-demo'
  const hrefs = page.blocks.flatMap((b) =>
    b._type === 'ctaBand' ? [b.cta.href] : b._type === 'hero' ? [b.primaryCta.href] : [],
  )
  return (Object.keys(GOAL_CTAS) as Goal[]).find((g) => hrefs.includes(GOAL_CTAS[g].href))
}

/** A reader-facing label for a link, from its target. */
function labelFor(href: string, goal: Goal | undefined): string {
  const fromGoal = (Object.values(GOAL_CTAS) as { label: string; href: string }[]).find(
    (c) => c.href === href,
  )
  if (fromGoal) return fromGoal.label
  if (href.startsWith('#how')) return 'See how a flight works'
  if (href.startsWith('#')) return clip(`Go to ${href.slice(1).replace(/-/g, ' ')}`, 32)
  return goal ? GOAL_CTAS[goal].label : 'Talk to an inspection lead'
}

/** Headings: keep the first clause if it is long enough, else clip at a word. */
function shortenHeading(text: string, max = FIX_LIMITS.heading): string {
  if (text.length <= max) return text
  const clause = text.split(/\s*(?:[:;—–]|\s-\s|,)\s*/)[0] ?? ''
  if (clause.length >= 20 && clause.length <= max) return clause
  return clip(text, max)
}

const HEADING_FIELDS = new Set(['heading', 'title'])
const BODY_FIELDS = new Set(['subheading', 'body', 'intro', 'summary', 'answer', 'detail'])

function mapStrings(
  value: unknown,
  fn: (text: string, field: string) => string,
  field = '',
): unknown {
  if (typeof value === 'string') return fn(value, field)
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn, field))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k.startsWith('_') || k === 'href' ? v : mapStrings(v, fn, k),
      ]),
    )
  }
  return value
}

/**
 * Apply fixes that need no model. Returns the new block and a list of what changed.
 * Never touches fact-bearing fields (names, quotes, stats), only headings,
 * paragraphs and link labels.
 */
export function applyDeterministicFix(
  block: Block,
  issueIds: Set<string>,
  goal: Goal | undefined,
): { block: Block; changes: string[] } {
  const changes: string[] = []
  let next = block

  if (issueIds.has('link-text') || issueIds.has('link-name')) {
    const fixLink = (l: { label: string; href: string }) => {
      if (!GENERIC_LINK_LABELS.includes(norm(l.label)) && l.label.trim().length >= 3) return l
      changes.push(`renamed link “${l.label}”`)
      return { ...l, label: labelFor(l.href, goal) }
    }
    if (next._type === 'hero') {
      next = {
        ...next,
        primaryCta: fixLink(next.primaryCta),
        ...(next.secondaryCta ? { secondaryCta: fixLink(next.secondaryCta) } : {}),
      }
    } else if (next._type === 'ctaBand') {
      next = { ...next, cta: fixLink(next.cta) }
    }
  }

  if (issueIds.has('heading-wrap') || issueIds.has('heading-too-long')) {
    // Fact-bearing text (case study heading, quotes) is left for the model.
    const factual = next._type === 'caseStudy' || next._type === 'testimonial'
    if (!factual) {
      next = mapStrings(next, (text, field) => {
        if (!HEADING_FIELDS.has(field) || text.length <= FIX_LIMITS.heading) return text
        const short = shortenHeading(text)
        if (short !== text) changes.push(`shortened ${field} to ${short.length} chars`)
        return short
      }) as Block
    }
  }

  if (issueIds.has('block-too-tall') || issueIds.has('text-too-long')) {
    const factual = next._type === 'testimonial'
    if (!factual) {
      next = mapStrings(next, (text, field) => {
        if (!BODY_FIELDS.has(field) || text.length < 120) return text
        const short = clipSentences(text, Math.round(text.length * FIX_LIMITS.bodyRatio))
        if (short !== text)
          changes.push(`trimmed ${field} from ${text.length} to ${short.length} chars`)
        return short
      }) as Block
    }
  }
  return { block: next, changes }
}

/**
 * Fixer: maps QA issues (traced to blocks via `blockKey`) to content edits.
 * 1. Deterministic edits, no model call.
 * 2. One model call for issues that need rewriting, sending only those blocks.
 * 3. Re-validate against the brand facts; model edits that break a rule are dropped.
 */
export const fixPage: FixPage = async (page, qa, deps) => {
  const { steps, record } = createStepRecorder(deps)
  const goal = inferGoal(page)
  const byBlock = groupIssues(qa.issues, page)
  let current = page
  const touched = new Set<string>()

  // 1. Deterministic pass.
  const deterministicTargets = [...byBlock].filter(([, ids]) =>
    [...ids].some((id) => FIXABLE.deterministic.has(id)),
  )
  if (deterministicTargets.length) {
    current = await record('fix', 'fixing', async () => {
      const changes: string[] = []
      const next: Page = {
        ...current,
        blocks: current.blocks.map((b) => {
          const ids = byBlock.get(b._key)
          if (!ids) return b
          const r = applyDeterministicFix(b, ids, goal)
          if (r.changes.length) touched.add(b._key)
          changes.push(...r.changes)
          return r.block
        }),
      }
      const v = validatePage(next, deps.facts, goal ? { goal } : undefined)
      const ok = v.ok || !introducesNewErrors(page, next, deps.facts, goal)
      return {
        value: ok ? next : current,
        ok,
        summary: changes.length
          ? `${summarize(changes)} (no model call)`
          : 'No deterministic fix applied',
        ...(ok ? {} : { error: v.errors.slice(0, 5).join('\n') }),
      }
    })
  }

  // 2. Model pass for the blocks that still need rewriting.
  const rewriteKeys = [...byBlock]
    .filter(([key, ids]) =>
      [...ids].some(
        (id) =>
          FIXABLE.rewrite.has(id) ||
          // Deterministic fix did not change anything for this block.
          (FIXABLE.deterministic.has(id) && !touched.has(key)),
      ),
    )
    .map(([key]) => key)
  const rewriteBlocks = current.blocks.filter((b) => rewriteKeys.includes(b._key))

  if (rewriteBlocks.length) {
    const issueText = qa.issues
      .filter((i) => i.blockKey && rewriteKeys.includes(i.blockKey))
      .slice(0, 20)
      .map((i) => `[${i.blockKey}] ${i.id}: ${clip(i.message, 200)}`)
    const siteType = current.blocks.find((b) => b._type === 'hero')
    const { system, prompt } = fixerPrompt(
      deps.facts,
      { goal, siteType: siteType?._type === 'hero' ? siteType.siteType : 'refinery' },
      rewriteBlocks,
      issueText,
    )
    try {
      current = await record('fix', 'fixing', async () => {
        const res = await deps.llm.generateJson({
          system,
          prompt,
          schema: fixerOutputSchema(rewriteBlocks.map((b) => b._type)),
          task: 'fixer',
          temperature: 0.3,
        })
        const candidate = mergeBlocks(current, { blocks: res.data.blocks })
        // Keep only rewritten blocks that do not add validation errors.
        const accepted = keepValidBlocks(current, candidate, deps.facts, goal)
        const n = accepted.accepted.length
        return {
          value: accepted.page,
          model: res.model,
          tokens: res.tokens,
          ok: n > 0,
          summary: n
            ? `Rewrote ${n} block${n === 1 ? '' : 's'} (${accepted.accepted.join(', ')}) for ${issueText.length} QA issue${issueText.length === 1 ? '' : 's'}`
            : 'Model rewrite rejected: it broke brand-fact rules',
          ...(accepted.rejected.length
            ? { error: `Rejected: ${accepted.rejected.join(', ')}` }
            : {}),
        }
      })
    } catch (e) {
      // A failed model call leaves the deterministic fixes in place.
      if (!isLlmError(e)) throw e
    }
  }

  const skipped = qa.issues.filter(
    (i) => !i.blockKey || !(FIXABLE.deterministic.has(i.id) || FIXABLE.rewrite.has(i.id)),
  )
  if (!steps.length) {
    await record('fix', 'fixing', async () => ({
      value: null,
      ok: false,
      summary: skipped.length
        ? `${skipped.length} QA issue${skipped.length === 1 ? '' : 's'} need design-system or code changes, not content edits`
        : 'Nothing to fix',
    }))
  }

  const changed = JSON.stringify(current) !== JSON.stringify(page)
  return { page: current, steps, changed }
}

/** Issues grouped by block key → set of issue ids. Unknown keys are ignored. */
function groupIssues(issues: QaIssue[], page: Page): Map<string, Set<string>> {
  const keys = new Set(page.blocks.map((b) => b._key))
  const map = new Map<string, Set<string>>()
  for (const i of issues) {
    if (!i.blockKey || !keys.has(i.blockKey)) continue
    const set = map.get(i.blockKey) ?? new Set<string>()
    set.add(i.id)
    map.set(i.blockKey, set)
  }
  return map
}

function introducesNewErrors(
  before: Page,
  after: Page,
  facts: BrandFacts,
  goal: Goal | undefined,
): boolean {
  const g = goal ? { goal } : undefined
  const a = new Set(validatePage(before, facts, g).errors)
  return validatePage(after, facts, g).errors.some((e) => !a.has(e))
}

function keepValidBlocks(
  before: Page,
  candidate: Page,
  facts: BrandFacts,
  goal: Goal | undefined,
): { page: Page; accepted: string[]; rejected: string[] } {
  const accepted: string[] = []
  const rejected: string[] = []
  let page = before
  candidate.blocks.forEach((b, i) => {
    const old = before.blocks[i]!
    if (JSON.stringify(old) === JSON.stringify(b)) return
    const trial: Page = { ...page, blocks: page.blocks.map((x, j) => (j === i ? b : x)) }
    if (introducesNewErrors(page, trial, facts, goal)) {
      rejected.push(b._key)
    } else {
      page = trial
      accepted.push(b._key)
    }
  })
  return { page, accepted, rejected }
}

function summarize(changes: string[]): string {
  const n = (prefix: string) => changes.filter((c) => c.startsWith(prefix)).length
  const parts = [
    [n('renamed'), 'link'],
    [n('shortened'), 'heading'],
    [n('trimmed'), 'paragraph'],
  ] as const
  const verbs = ['Renamed', 'shortened', 'trimmed']
  return parts
    .map(([count, noun], i) =>
      count ? `${verbs[i]} ${count} ${noun}${count === 1 ? '' : 's'}` : '',
    )
    .filter(Boolean)
    .join(', ')
    .replace(/^\w/, (m) => m.toUpperCase())
}
