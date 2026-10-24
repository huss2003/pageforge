import type { Block, BlockKind } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import type { Brief, LlmClient, LlmResult, PagePlan } from '../types'
import { LlmError } from './errors'
import { composeBlock, composePage, composePlan } from './compose'
import { formatIssues, type GenerateJsonOpts } from './shared'

export const FAKE_MODEL = 'simulated'

export interface FakeLlmOptions {
  /** Artificial delay per call so the demo timeline feels real. Default 0. */
  latencyMs?: number
  model?: string
}

/**
 * Deterministic, offline model. Reads the tagged lines our prompts contain
 * (BRIEF:, PLAN:, BLOCKS:) and composes output from the brand facts.
 * Used by tests and by the public demo's keyless simulation mode.
 */
export class FakeLlm implements LlmClient {
  readonly provider = 'fake'
  readonly simulated = true
  readonly model: string
  readonly calls: { task: string; prompt: string }[] = []
  private readonly latencyMs: number

  constructor(
    private readonly facts: BrandFacts,
    opts: FakeLlmOptions = {},
  ) {
    this.model = opts.model ?? FAKE_MODEL
    this.latencyMs = opts.latencyMs ?? 0
  }

  async generateJson<T>(opts: GenerateJsonOpts<T>): Promise<LlmResult<T>> {
    this.calls.push({ task: opts.task, prompt: opts.prompt })
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs))
    const output = this.answer(opts)
    const parsed = opts.schema.safeParse(output)
    if (!parsed.success) {
      throw new LlmError({
        kind: 'schema',
        provider: this.provider,
        model: this.model,
        message: `FakeLlm output for ${opts.task} did not match the schema`,
        raw: output,
        issues: formatIssues(parsed.error),
      })
    }
    const text = JSON.stringify(output)
    return {
      data: parsed.data,
      model: this.model,
      tokens: {
        input: Math.ceil((opts.system.length + opts.prompt.length) / 4),
        output: Math.ceil(text.length / 4),
      },
    }
  }

  private answer(opts: GenerateJsonOpts<unknown>): unknown {
    const brief = tagged<Brief>(opts.prompt, 'BRIEF')
    switch (opts.task) {
      case 'planner':
        if (!brief) throw missing('BRIEF', opts.task)
        return composePlan(brief, this.facts)
      case 'writer': {
        const plan = tagged<PagePlan>(opts.prompt, 'PLAN')
        if (!brief || !plan) throw missing('BRIEF/PLAN', opts.task)
        return composePage(brief, plan, this.facts)
      }
      case 'writer-retry': {
        const plan = tagged<PagePlan>(opts.prompt, 'PLAN')
        if (!brief || !plan) throw missing('BRIEF/PLAN', opts.task)
        const blocks = tagged<Block[]>(opts.prompt, 'BLOCKS')
        // Full rewrite: the prompt carries the whole plan.
        if (!blocks) return composePage(brief, plan, this.facts)
        // Targeted retry: recompose only the listed blocks, plus fresh title/seo.
        const page = composePage(brief, { ...plan, slug: 'x', sections: [] }, this.facts)
        return {
          title: page.title,
          seo: page.seo,
          blocks: fakeRetryBlocks(brief, blocks, this.facts),
        }
      }
      case 'fixer': {
        const ctx = tagged<{
          goal?: Brief['goal']
          siteType: Brief['siteType']
          prospect?: string
          audience?: string[]
        }>(opts.prompt, 'CONTEXT')
        const blocks = tagged<Block[]>(opts.prompt, 'BLOCKS') ?? []
        const b: Brief = {
          prospect: ctx?.prospect ?? 'your site',
          siteType: ctx?.siteType ?? 'refinery',
          audience: ctx?.audience?.length ? ctx.audience : ['Maintenance managers'],
          goal: ctx?.goal ?? 'contact-sales',
        }
        return {
          blocks: blocks.map((x) =>
            composeBlock(x._type as BlockKind, x._key, b, { title: '', angle: '' }, this.facts),
          ),
        }
      }
      default:
        throw new LlmError({
          kind: 'bad-request',
          provider: this.provider,
          model: this.model,
          message: `FakeLlm does not know task "${opts.task}"`,
        })
    }
  }
}

/** Targeted retry: recompose only the blocks the prompt listed. */
export function fakeRetryBlocks(brief: Brief, blocks: Block[], facts: BrandFacts): Block[] {
  return blocks.map((b) => composeBlock(b._type, b._key, brief, { title: '', angle: '' }, facts))
}

function tagged<T>(prompt: string, tag: string): T | undefined {
  const m = new RegExp(`^${tag}: (.*)$`, 'm').exec(prompt)
  if (!m?.[1]) return undefined
  try {
    return JSON.parse(m[1]) as T
  } catch {
    return undefined
  }
}

function missing(what: string, task: string) {
  return new LlmError({
    kind: 'bad-request',
    provider: 'fake',
    model: FAKE_MODEL,
    message: `FakeLlm: ${what} line missing from ${task} prompt`,
  })
}
