import { z } from 'zod'
import {
  blockSchema,
  pageSchema,
  registry,
  type Block,
  type BlockKind,
  type Page,
} from '@pageforge/blocks'
import { LlmError, isLlmError } from '../llm/errors'
import type { LlmClient } from '../types'
import { blockShapes } from './shapes'
import {
  INDUSTRY_SITE_TYPE,
  type AbmBrief,
  type AbmGoal,
  type AccountFact,
  type ClaimSource,
  type DraftClaim,
  type DraftResult,
  type ProductFact,
} from './types'

/** Blocks the ABM drafter may use (every registry block except the operator strip). */
export const ABM_BLOCK_KINDS: BlockKind[] = (Object.keys(registry) as BlockKind[]).filter(
  (k) => k !== 'operatorStrip',
)

export const GOAL_CLOSING: Record<AbmGoal, { closing: BlockKind; label: string; href: string }> = {
  'book-meeting': { closing: 'demoForm', label: 'Book a demo call', href: '#demo-form' },
  'download-report': { closing: 'ctaBand', label: 'Request a sample report', href: '#contact' },
  'event-invite': { closing: 'ctaBand', label: 'Request an event seat', href: '#contact' },
}

const claimOutput = z.object({
  blockKey: z.string().min(1).max(64),
  field: z.string().min(1).max(80),
  text: z.string().trim().min(1).max(700),
  kind: z.enum(['product_fact', 'account_fact', 'positioning']),
  productFactIds: z.array(z.string().max(80)).max(8).default([]),
  accountFactIds: z.array(z.string().max(16)).max(6).default([]),
})

export const draftOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  seoTitle: z.string().trim().min(1).max(200),
  seoDescription: z.string().trim().min(1).max(400),
  // Keys are bookkeeping, not content: fill any the model left out with the
  // "b1", "b2" … convention the prompt asks for, so claims still line up.
  blocks: z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v.map((b, i) =>
            b && typeof b === 'object' && typeof (b as { _key?: unknown })._key !== 'string'
              ? { ...b, _key: `b${i + 1}` }
              : b,
          )
        : v,
    z.array(blockSchema).min(3).max(10),
  ),
  claims: z.array(claimOutput).max(48),
})

export type DraftOutput = Omit<z.input<typeof draftOutputSchema>, 'blocks'> & {
  blocks: z.input<typeof blockSchema>[]
}
type ParsedDraft = z.output<typeof draftOutputSchema>

export interface DraftInput {
  brief: AbmBrief
  productFacts: ProductFact[]
  /** Included account facts only. */
  accountFacts: AccountFact[]
  /** URL slug for the page (the campaign slug). Default: from the company name. */
  slug?: string
  noindex?: boolean
  bannedPhrases?: string[]
}

/** Short refs ("A1", "A2" …) for account facts keep the prompt small. */
function accountRefs(facts: AccountFact[]) {
  return facts.map((f, i) => ({ ref: `A${i + 1}`, fact: f }))
}

export function draftPrompt(input: DraftInput) {
  const { brief } = input
  const goal = GOAL_CLOSING[brief.goal]
  const siteType = INDUSTRY_SITE_TYPE[brief.industry]
  const refs = accountRefs(input.accountFacts)
  const system = `You write one landing page for Hoverline (a drone-inspection company) addressed to ONE target account, as JSON.
Use ONLY the facts given. Rules:
- Every factual statement must be listed in "claims" with the block _key, the field path inside the block (e.g. "subheading", "features[1].body", "stats[0]", "items[2].answer"), the exact text as it appears in the copy, its kind and its sources.
- kind "product_fact": about Hoverline; cite PRODUCT FACT ids in productFactIds. Copy numbers, names and certifications exactly from the cited fact.
- kind "account_fact": about the account; cite ACCOUNT FACT refs (A1, A2 …) in accountFactIds. Stay close to the quote's wording and numbers.
- kind "positioning": opinion or framing with NO numbers, customer names or certifications; no sources.
- Never invent customers, numbers, savings, percentages, quotes or certifications. Never claim the account is a Hoverline customer. If a fact is not given, do not state it.
- Blocks: choose from BLOCK SHAPES only, 5 to 8 blocks. First block: hero (siteType "${siteType}"). Last block: ${goal.closing}. Each _key unique ("b1", "b2" …). Respect every max length.
- Hero primaryCta: {"label":"${goal.label}","href":"${goal.href}"}.
- Plain, specific sentences an operations or security lead would use; sentence case headings; no exclamation marks; no hype.
${input.bannedPhrases?.length ? `- Never use these words: ${input.bannedPhrases.join(', ')}.\n` : ''}Output JSON: {"title","seoTitle"(≤60, no brand suffix: the site appends " | Hoverline"),"seoDescription"(≤160),"blocks":[...],"claims":[{"blockKey","field","text","kind","productFactIds":[],"accountFactIds":[]}]}

BLOCK SHAPES:
${blockShapes(ABM_BLOCK_KINDS)}`
  const prompt = `BRIEF: ${JSON.stringify(brief)}
ACCOUNT_FACTS: ${JSON.stringify(refs.map((r) => ({ ref: r.ref, quote: r.fact.quote, category: r.fact.category })))}
PRODUCT FACTS (id: text):
${input.productFacts.map((f) => `${f.id}: ${f.text}`).join('\n')}`
  return { system, prompt }
}

export function repairPrompt(input: DraftInput, previous: unknown, issues: string[]) {
  const base = draftPrompt(input)
  return {
    system: base.system,
    prompt: `${base.prompt}

Your previous answer had these problems. Return the full corrected JSON.
PROBLEMS:
${issues.map((i) => `- ${i}`).join('\n')}
PREVIOUS: ${(JSON.stringify(previous) ?? 'null').slice(0, 12_000)}`,
  }
}

/**
 * Draft an account page: one model call, plus at most one repair call when
 * the output does not fit the block contract. Returns a zod-valid page that
 * uses only registry blocks, and the claims list with resolved sources.
 */
export async function draftAccountPage(llm: LlmClient, input: DraftInput): Promise<DraftResult> {
  let calls = 0
  let model = 'unknown'
  let raw: unknown
  let parsed: ParsedDraft | null = null
  let issues: string[] = []

  const attempt = async (p: { system: string; prompt: string }, task: string) => {
    calls++
    try {
      const res = await llm.generateJson({
        ...p,
        schema: draftOutputSchema,
        task,
        temperature: 0.4,
        // The block union is large; plain JSON plus zod is far faster than
        // schema-constrained decoding and the prompt already lists each shape.
        constrained: false,
      })
      model = res.model
      raw = res.data
      return res.data
    } catch (e) {
      if (isLlmError(e) && e.kind === 'schema') {
        model = e.model
        raw = e.raw
        issues = e.issues ?? [e.message]
        return null
      }
      throw e
    }
  }

  parsed = await attempt(draftPrompt(input), 'abm-draft')
  let page = parsed ? assemble(parsed, input) : null
  if (parsed && page) issues = structureIssues(page, input)
  if (!page || issues.length) {
    parsed = await attempt(repairPrompt(input, raw, issues), 'abm-repair')
    page = parsed ? assemble(parsed, input) : null
    if (parsed && page) issues = structureIssues(page, input)
    if (!page || issues.length) {
      throw new LlmError({
        kind: 'schema',
        provider: 'abm',
        model,
        message: `The draft did not fit the block library after a repair: ${issues.slice(0, 3).join('; ')}`,
        issues,
        raw,
      })
    }
  }
  return { page, claims: resolveClaims(parsed!, input), model, calls }
}

function slugFrom(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-')
      .slice(0, 60)
      .replace(/-+$/, '') || 'account'
  )
}

const clipTo = (t: string, max: number) => {
  const s = t.trim().replace(/\s+/g, ' ')
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s,;:|–—-]+$/, '')
}

/** Model output → Page, with deterministic fixes the model should not have to get right. */
function assemble(out: ParsedDraft, input: DraftInput): Page | null {
  const siteType = INDUSTRY_SITE_TYPE[input.brief.industry]
  const seen = new Set<string>()
  const blocks: Block[] = out.blocks.map((b, i) => {
    let key = b._key
    if (seen.has(key)) key = `b${i + 1}x`
    seen.add(key)
    const copy = { ...b, _key: key } as Block
    if (copy._type === 'hero') copy.siteType = siteType
    return copy
  })
  const page = {
    kind: 'landing' as const,
    title: clipTo(out.title, 90),
    slug: input.slug ?? slugFrom(input.brief.companyName),
    seo: {
      title: clipTo(out.seoTitle.replace(/\s*[|·–—-]\s*Hoverline\s*$/i, ''), 60),
      description: clipTo(out.seoDescription, 160),
      noindex: input.noindex ?? true,
    },
    blocks,
  }
  const parsed = pageSchema.safeParse(page)
  return parsed.success ? parsed.data : null
}

function structureIssues(page: Page, input: DraftInput): string[] {
  const issues: string[] = []
  const goal = GOAL_CLOSING[input.brief.goal]
  if (page.blocks[0]?._type !== 'hero') issues.push('The first block must be a hero.')
  const last = page.blocks[page.blocks.length - 1]
  if (last?._type !== goal.closing) issues.push(`The last block must be ${goal.closing}.`)
  const counts = new Map<BlockKind, number>()
  for (const b of page.blocks) {
    if (!ABM_BLOCK_KINDS.includes(b._type)) issues.push(`Block kind ${b._type} is not allowed.`)
    counts.set(b._type, (counts.get(b._type) ?? 0) + 1)
  }
  for (const [k, n] of counts)
    if (n > registry[k].maxPerPage)
      issues.push(`Use ${k} at most ${registry[k].maxPerPage} time(s).`)
  return issues
}

function resolveClaims(out: ParsedDraft, input: DraftInput): DraftClaim[] {
  const product = new Map(input.productFacts.map((f) => [f.id, f]))
  const account = new Map(accountRefs(input.accountFacts).map((r) => [r.ref, r.fact]))
  const keys = new Set(out.blocks.map((b) => b._key))
  return out.claims
    .filter((c) => keys.has(c.blockKey))
    .map((c) => {
      const sources: ClaimSource[] = []
      const unresolved: string[] = []
      for (const id of c.productFactIds) {
        const f = product.get(id)
        if (f) sources.push({ type: 'product_fact', factId: f.id, label: f.label })
        else unresolved.push(id)
      }
      for (const ref of c.accountFactIds) {
        const f = account.get(ref)
        if (f)
          sources.push({ type: 'account_source', sourceFactId: f.id, url: f.url, quote: f.quote })
        else unresolved.push(ref)
      }
      return {
        blockKey: c.blockKey,
        field: c.field,
        text: c.text,
        kind: c.kind,
        sources,
        ...(unresolved.length ? { unresolved } : {}),
        origin: 'draft' as const,
      }
    })
}
