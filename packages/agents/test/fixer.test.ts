import { describe, expect, it } from 'vitest'
import type { Page } from '@pageforge/blocks'
import type { QaResult } from '@pageforge/qa'
import { FakeLlm, fixPage, inferGoal, validatePage } from '../src'
import { clone, facts, fakeDeps, goodPage, refineryBrief, substationBrief } from './helpers'

const scores = { performance: 98, accessibility: 90, seo: 100, bestPractices: 100 }

function qa(issues: QaResult['issues']): QaResult {
  return { url: 'https://example.test/preview/x', scores, issues, passed: false }
}

function keyOf(page: Page, kind: string) {
  return page.blocks.find((b) => b._type === kind)!._key
}

describe('fixPage deterministic fixes', () => {
  it('renames generic link labels without a model call', async () => {
    const page = clone(goodPage(substationBrief))
    const hero = page.blocks[0]!
    if (hero._type !== 'hero') throw new Error('hero expected')
    hero.primaryCta.label = 'Click here'
    const { deps, llm } = fakeDeps()
    const out = await fixPage(
      page,
      qa([
        {
          source: 'lighthouse',
          id: 'link-text',
          message: 'Links do not have descriptive text',
          blockKey: hero._key,
        },
      ]),
      deps,
    )

    expect(llm.calls).toHaveLength(0)
    expect(out.changed).toBe(true)
    const fixed = out.page.blocks[0]!
    expect(fixed._type === 'hero' && fixed.primaryCta.label).toBe('Talk to an inspection lead')
    expect(out.steps).toHaveLength(1)
    expect(out.steps[0]!.summary).toBe('Renamed 1 link (no model call)')
    expect(validatePage(out.page, facts, substationBrief).ok).toBe(true)
  })

  it('shortens overlong headings and trims long paragraphs in the flagged block only', async () => {
    const page = clone(goodPage())
    const grid = page.blocks.find((b) => b._type === 'featureGrid')!
    if (grid._type !== 'featureGrid') throw new Error()
    grid.heading =
      'What reliability engineers get from every flight: thermal, visual and change detection'
    grid.intro =
      'Each route covers your storage tanks, flare stacks and pipe racks. Findings are compared with earlier flights. Tank shell corrosion shows up while it is still a planned repair. Your team sees it the same day.'
    const before = clone(page)
    const { deps, llm } = fakeDeps()
    const out = await fixPage(
      page,
      qa([
        {
          source: 'visual',
          id: 'heading-wrap',
          message: 'Heading wraps to 4 lines at 375px',
          blockKey: grid._key,
        },
        {
          source: 'visual',
          id: 'block-too-tall',
          message: 'Block is 2.4 screens tall on mobile',
          blockKey: grid._key,
        },
      ]),
      deps,
    )
    expect(llm.calls).toHaveLength(0)
    const fixed = out.page.blocks.find((b) => b._key === grid._key)!
    if (fixed._type !== 'featureGrid') throw new Error()
    expect(fixed.heading).toBe('What reliability engineers get from every flight')
    expect(fixed.intro!.length).toBeLessThan(grid.intro.length)
    expect(fixed.intro!.endsWith('.')).toBe(true)
    // Other blocks untouched; facts in the grid untouched.
    expect(out.page.blocks.filter((b) => b._key !== grid._key)).toEqual(
      before.blocks.filter((b) => b._key !== grid._key),
    )
    expect(fixed.features).toEqual(grid.features)
    expect(out.steps[0]!.summary).toBe('Shortened 1 heading, trimmed 1 paragraph (no model call)')
  })

  it('never edits fact-bearing blocks deterministically', async () => {
    const page = clone(goodPage())
    const csKey = keyOf(page, 'caseStudy')
    const { deps } = fakeDeps()
    const out = await fixPage(
      page,
      qa([{ source: 'visual', id: 'heading-wrap', message: 'wraps', blockKey: csKey }]),
      deps,
    )
    const cs = out.page.blocks.find((b) => b._key === csKey)!
    expect(cs).toEqual(page.blocks.find((b) => b._key === csKey))
  })
})

describe('fixPage model path', () => {
  it('sends only the affected blocks to the model and re-validates', async () => {
    const page = clone(goodPage())
    const statsKey = keyOf(page, 'statsBand')
    const { deps, llm } = fakeDeps(new FakeLlm(facts))
    const out = await fixPage(
      page,
      qa([
        {
          source: 'visual',
          id: 'horizontal-overflow',
          message: 'Content overflows at 375px',
          blockKey: statsKey,
        },
      ]),
      deps,
    )
    expect(llm.calls.map((c) => c.task)).toEqual(['fixer'])
    const prompt = llm.calls[0]!.prompt
    expect(prompt).toContain(`"_key":"${statsKey}"`)
    expect(prompt).not.toContain('"_type":"hero"')
    expect(out.steps.at(-1)!.model).toBe('simulated')
    expect(validatePage(out.page, facts, refineryBrief).ok).toBe(true)
  })

  it('reports issues it cannot fix with content edits', async () => {
    const { deps, llm } = fakeDeps()
    const out = await fixPage(
      goodPage(),
      qa([{ source: 'lighthouse', id: 'unused-javascript', message: 'Reduce unused JS' }]),
      deps,
    )
    expect(llm.calls).toHaveLength(0)
    expect(out.changed).toBe(false)
    expect(out.steps[0]!.summary).toMatch(/need design-system or code changes/)
  })
})

describe('inferGoal', () => {
  it('recovers the goal from the closing block and CTA href', () => {
    expect(inferGoal(goodPage(refineryBrief))).toBe('book-demo')
    expect(inferGoal(goodPage(substationBrief))).toBe('contact-sales')
  })
})
