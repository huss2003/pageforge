import type { BrandFacts } from '@pageforge/content'
import { simulateDraft, simulateSelectFacts, type SimAccountFact } from '../abm/simulate'
import type { AbmBrief } from '../abm/types'
import type { LlmClient, LlmResult } from '../types'
import { LlmError } from './errors'
import { formatIssues, type GenerateJsonOpts } from './shared'

export const FAKE_MODEL = 'simulated'

export interface FakeLlmOptions {
  /** Artificial delay per call so the demo timeline feels real. Default 0. */
  latencyMs?: number
  model?: string
}

/**
 * Deterministic, offline model. Reads the tagged lines our prompts contain
 * (BRIEF:, SENTENCES:, ACCOUNT_FACTS:) and composes output from the brand
 * facts. Used by tests and by the public demo's keyless simulation mode.
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
    switch (opts.task) {
      case 'abm-select-facts': {
        const sentences = tagged<string[]>(opts.prompt, 'SENTENCES')
        if (!sentences) throw missing('SENTENCES', opts.task)
        return simulateSelectFacts(sentences)
      }
      case 'abm-draft':
      case 'abm-repair': {
        const brief = tagged<AbmBrief>(opts.prompt, 'BRIEF')
        const accountFacts = tagged<SimAccountFact[]>(opts.prompt, 'ACCOUNT_FACTS') ?? []
        if (!brief) throw missing('BRIEF', opts.task)
        return simulateDraft(brief, accountFacts, this.facts)
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
