import { z } from 'zod'
import { pageSchema, registry, seoSchema, type Block, type Page } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import { GOAL_CTAS } from './goals'
import { writerPrompt, writerRetryPrompt } from './prompts'
import { fixerOutputSchema, writerOutputSchema } from './schemas'
import { clip } from './text'
import type { Brief, LlmClient, LlmResult, PagePlan } from './types'
import { RESERVED_SLUGS, type ValidationIssue } from './validator'

type WriterDeps = { llm: LlmClient; facts: BrandFacts }

/**
 * Writer: one model call turns the plan into a full Page. Fields the model
 * should not decide (kind, slug, noindex, keys, CTA targets, block order) are
 * pinned in code afterwards, so validation failures are about copy and facts.
 */
export async function writePage(
  brief: Brief,
  plan: PagePlan,
  deps: WriterDeps,
): Promise<LlmResult<Page>> {
  const { system, prompt } = writerPrompt(brief, plan, deps.facts)
  const res = await deps.llm.generateJson({
    system,
    prompt,
    schema: writerOutputSchema(plan.sections.map((s) => s.kind)),
    task: 'writer',
    temperature: 0.6,
  })
  return { ...res, data: finalizePage(res.data, brief, plan) }
}

const retryOutputSchema = (kinds: Block['_type'][]) =>
  z.object({
    title: z.string().trim().min(1).max(90).optional(),
    seo: seoSchema.partial().optional(),
    blocks: fixerOutputSchema(kinds).shape.blocks.optional(),
  })

/** Rules a targeted (block-level) retry can fix; anything else gets a full rewrite. */
const TARGETED_RULES = new Set<ValidationIssue['rule']>([
  'fact',
  'stat',
  'number',
  'banned-phrase',
  'link-label',
  'seo',
])

/**
 * Retry after validation failed. When every issue is inside known blocks
 * (or the SEO fields), only those blocks and the validator's messages are
 * sent and the corrected blocks are merged back by `_key` — far fewer tokens
 * than a full rewrite. Otherwise the whole page is rewritten with the errors.
 */
export async function rewritePage(
  brief: Brief,
  plan: PagePlan,
  previous: unknown,
  issues: ValidationIssue[],
  deps: WriterDeps,
): Promise<LlmResult<Page>> {
  const errors = issues.map((i) => i.message)
  const prev = pageSchema.safeParse(previous)
  // Page-level issues without a block (title/seo copy) are fixable via title/seo.
  const targeted = prev.success && issues.every((i) => TARGETED_RULES.has(i.rule))

  if (!prev.success || !targeted) {
    const { system, prompt } = writerPrompt(brief, plan, deps.facts)
    const res = await deps.llm.generateJson({
      system,
      prompt: `${prompt}\n\nYour previous answer failed validation:\n${errors.map((e) => `- ${e}`).join('\n')}\nReturn the full corrected page.`,
      schema: writerOutputSchema(plan.sections.map((s) => s.kind)),
      task: 'writer-retry',
      temperature: 0.4,
    })
    return { ...res, data: finalizePage(res.data, brief, plan) }
  }

  const page = prev.data
  const keys = [...new Set(issues.map((i) => i.blockKey).filter((k): k is string => !!k))]
  const kinds = page.blocks.filter((b) => keys.includes(b._key)).map((b) => b._type)
  const { system, prompt } = writerRetryPrompt(brief, plan, deps.facts, page, errors, keys)
  const res = await deps.llm.generateJson({
    system,
    prompt,
    schema: retryOutputSchema(kinds.length ? kinds : page.blocks.map((b) => b._type)),
    task: 'writer-retry',
    temperature: 0.4,
  })
  return { ...res, data: finalizePage(mergeBlocks(page, res.data), brief, plan) }
}

/** Merge partial output ({title?, seo?, blocks?}) into a page by block `_key`. */
export function mergeBlocks(
  page: Page,
  patch: { title?: string; seo?: Partial<Page['seo']>; blocks?: Block[] },
): Page {
  const byKey = new Map((patch.blocks ?? []).map((b) => [b._key, b]))
  return {
    ...page,
    title: patch.title ? clip(patch.title, 90) : page.title,
    seo: { ...page.seo, ...stripUndefined(patch.seo ?? {}) },
    blocks: page.blocks.map((b) => {
      const next = byKey.get(b._key)
      return next && next._type === b._type ? next : b
    }),
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

/**
 * Pin non-creative fields: kind, slug, noindex, unique short keys, hero site
 * type, CTA targets, and block order/count per the plan.
 */
export function finalizePage(
  page: Omit<Page, 'kind'> & { kind?: Page['kind'] },
  brief: Brief,
  plan: PagePlan,
): Page {
  const cta = GOAL_CTAS[brief.goal]
  const ordered = conformToPlan(page.blocks, plan)
  const used = new Set<string>()
  const blocks = ordered.map((b, i) => {
    let key = (b._key || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || `b${i + 1}`
    for (let n = 2; used.has(key); n++) key = `b${i + 1}-${n}`
    used.add(key)
    const block = { ...b, _key: key } as Block
    if (block._type === 'hero') {
      block.siteType = brief.siteType
      block.primaryCta = { label: block.primaryCta.label, href: cta.href }
    }
    if (block._type === 'ctaBand') block.cta = { label: block.cta.label, href: cta.href }
    return block
  })
  const slug = RESERVED_SLUGS.has(plan.slug) ? `${plan.slug}-landing` : plan.slug
  return {
    ...page,
    kind: 'landing',
    slug,
    seo: { ...page.seo, noindex: true },
    blocks,
  }
}

/**
 * Reorder blocks to follow the plan's section order, matching by kind.
 * Unplanned blocks are dropped when they would break maxPerPage; planned
 * blocks the model skipped are left missing (the validator reports them).
 */
function conformToPlan(blocks: Block[], plan: PagePlan): Block[] {
  const pool = [...blocks]
  const out: Block[] = []
  for (const s of plan.sections) {
    const i = pool.findIndex((b) => b._type === s.kind)
    if (i >= 0) out.push(pool.splice(i, 1)[0]!)
  }
  // Keep leftovers (before the closing block) if they fit the registry limits.
  const closing =
    out.length && registry[out[out.length - 1]!._type].placement === 'last' ? out.pop() : undefined
  for (const b of pool) {
    const count = out.filter((x) => x._type === b._type).length
    if (registry[b._type].placement === 'first' || registry[b._type].placement === 'last') continue
    if (count < registry[b._type].maxPerPage) out.push(b)
  }
  if (closing) out.push(closing)
  return out.length ? out : blocks
}
