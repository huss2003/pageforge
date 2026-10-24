import { describe, expect, it } from 'vitest'
import type { Block } from '@pageforge/blocks'
import {
  FakeLlm,
  LlmError,
  PipelineError,
  runPipeline,
  validatePage,
  type GenerateJsonOpts,
  type LlmClient,
  type LlmResult,
} from '../src'
import { facts, fakeDeps, refineryBrief, substationBrief } from './helpers'

describe('runPipeline with FakeLlm', () => {
  it('plans, writes, validates and saves a draft in two model calls', async () => {
    const { deps, events, saved, llm } = fakeDeps()
    const result = await runPipeline(refineryBrief, deps)

    expect(llm.calls.map((c) => c.task)).toEqual(['planner', 'writer'])
    expect(result.steps.map((s) => s.step)).toEqual(['plan', 'write', 'validate', 'draft'])
    expect(events.map((e) => e.status)).toEqual(['planning', 'writing', 'validating', 'drafted'])
    expect(result.steps.every((s) => s.ok)).toBe(true)

    const [plan, write] = result.steps
    expect(plan!.summary).toMatch(/^Planned \d sections around tank shell corrosion/)
    expect(plan!.model).toBe('simulated')
    expect(write!.tokens?.input).toBeGreaterThan(0)
    expect(result.steps[0]!.durationMs).toBe(250)

    const page = result.page
    expect(saved).toEqual([page])
    expect(result.draft.id).toBe(`drafts.${page.slug}`)
    expect(page.kind).toBe('landing')
    expect(page.seo.noindex).toBe(true)
    expect(page.blocks[0]!._type).toBe('hero')
    expect(page.blocks.at(-1)!._type).toBe('demoForm')
    expect(new Set(page.blocks.map((b) => b._key)).size).toBe(page.blocks.length)
    expect(page.blocks.length).toBeGreaterThanOrEqual(5)
    expect(page.blocks.length).toBeLessThanOrEqual(9)
    expect(validatePage(page, facts, refineryBrief).ok).toBe(true)
  })

  it('produces brief-specific output', async () => {
    const a = await runPipeline(refineryBrief, fakeDeps().deps)
    const b = await runPipeline(substationBrief, fakeDeps().deps)
    expect(a.page.slug).not.toBe(b.page.slug)
    expect(JSON.stringify(b.page)).toMatch(/overheating connectors/)
    expect(b.page.blocks.at(-1)!._type).toBe('ctaBand')
    expect(a.plan.sections.map((s) => s.kind)).toContain('comparisonTable') // notes mention rope access
  })

  it('rejects an invalid brief before any model call', async () => {
    const { deps, llm } = fakeDeps()
    await expect(runPipeline({ ...refineryBrief, audience: [] }, deps)).rejects.toBeInstanceOf(
      PipelineError,
    )
    expect(llm.calls).toHaveLength(0)
  })
})

/** Wraps FakeLlm and corrupts the first writer answer. */
class FlakyWriter implements LlmClient {
  readonly inner = new FakeLlm(facts)
  readonly tasks: string[] = []
  constructor(private readonly corrupt: (blocks: Block[]) => void) {}
  async generateJson<T>(opts: GenerateJsonOpts<T>): Promise<LlmResult<T>> {
    this.tasks.push(opts.task)
    const res = await this.inner.generateJson(opts)
    if (opts.task === 'writer') {
      const data = structuredClone(res.data) as { blocks: Block[] }
      this.corrupt(data.blocks)
      return { ...res, data: data as T }
    }
    return res
  }
}

describe('runPipeline retry path', () => {
  it('re-prompts the writer with validator errors and only the failing block', async () => {
    const llm = new FlakyWriter((blocks) => {
      const stats = blocks.find((b) => b._type === 'statsBand')
      if (stats?._type === 'statsBand') stats.stats[0]!.value = '99'
    })
    const { deps, events } = fakeDeps(llm as unknown as FakeLlm)
    const result = await runPipeline(refineryBrief, deps)

    expect(llm.tasks).toEqual(['planner', 'writer', 'writer-retry'])
    const validates = result.steps.filter((s) => s.step === 'validate')
    expect(validates.map((s) => s.ok)).toEqual([false, true])
    expect(validates[0]!.error).toMatch(/"99%" is not a brand-facts stat/)
    expect(events.filter((e) => e.log.step === 'write').map((e) => e.log.attempt)).toEqual([1, 2])

    const retryPrompt = llm.inner.calls.find((c) => c.task === 'writer-retry')!.prompt
    expect(retryPrompt).toContain('is not a brand-facts stat')
    expect(retryPrompt).toMatch(/BLOCKS: \[\{"_key":"b\d","_type":"statsBand"/)
    expect(retryPrompt).not.toContain('"_type":"hero"')
    expect(validatePage(result.page, facts, refineryBrief).ok).toBe(true)
  })

  it('treats schema-breaking model output as a validation failure and retries', async () => {
    let first = true
    const fake = new FakeLlm(facts)
    const llm: LlmClient = {
      async generateJson<T>(opts: GenerateJsonOpts<T>) {
        if (opts.task === 'writer' && first) {
          first = false
          const good = await fake.generateJson(opts)
          const raw = structuredClone(good.data) as { blocks: { heading?: string }[] }
          raw.blocks[0]!.heading = 'An extremely long hero heading '.repeat(5)
          throw new LlmError({
            kind: 'schema',
            provider: 'test',
            model: 'm',
            message: 'schema',
            raw,
          })
        }
        return fake.generateJson(opts)
      },
    }
    const result = await runPipeline(refineryBrief, fakeDeps(llm as FakeLlm).deps)
    const writes = result.steps.filter((s) => s.step === 'write')
    expect(writes.map((s) => s.ok)).toEqual([false, true])
    expect(result.steps.find((s) => s.step === 'validate')!.error).toMatch(
      /heading: must be at most 90/,
    )
  })

  it('fails after two retries and reports every step', async () => {
    const fake = new FakeLlm(facts)
    const llm: LlmClient = {
      async generateJson<T>(opts: GenerateJsonOpts<T>) {
        const res = await fake.generateJson(opts)
        if (opts.task.startsWith('writer')) {
          const data = structuredClone(res.data) as { seo?: { description?: string } }
          if (data.seo)
            data.seo.description =
              'A seamless next-generation platform for refineries and every other kind of industrial site.'
          return { ...res, data: data as T }
        }
        return res
      },
    }
    const { deps, events } = fakeDeps(llm as FakeLlm)
    const err = await runPipeline(refineryBrief, deps).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PipelineError)
    const steps = (err as PipelineError).steps
    expect(steps.filter((s) => s.step === 'write')).toHaveLength(3)
    expect(steps.filter((s) => s.step === 'validate' && s.summary !== 'Run failed')).toHaveLength(3)
    expect(events.at(-1)).toMatchObject({
      status: 'failed',
      log: { summary: 'Run failed', ok: false },
    })
    expect((err as Error).message).toMatch(/still invalid after 2 retries/)
  })
})
