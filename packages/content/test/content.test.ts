import { describe, expect, it } from 'vitest'
import { blockSchema, pageSchema, registry, type Block, type Page } from '@pageforge/blocks'
import { facts, seedPages } from '../src'

/** Every string in a value, recursively (keys excluded). */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

function blocksOf<K extends Block['_type']>(page: Page, kind: K) {
  return page.blocks.filter((b): b is Extract<Block, { _type: K }> => b._type === kind)
}

const copyFields = (b: Block) => {
  // `_key`, `_type`, hrefs and enum values are not copy.
  const { _key, _type, ...rest } = b as Record<string, unknown>
  void _key
  void _type
  return strings(rest).filter((s) => !s.startsWith('/') && !s.startsWith('#'))
}

describe('seed pages', () => {
  it('has unique slugs', () => {
    const slugs = seedPages.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it.each(seedPages.map((p) => [p.slug, p] as const))('%s parses with pageSchema', (_, page) => {
    const result = pageSchema.safeParse(page)
    if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2))
    expect(result.success).toBe(true)
  })

  it.each(seedPages.map((p) => [p.slug, p] as const))(
    '%s follows block placement and per-page limits',
    (_, page) => {
      expect(page.blocks[0]?._type).toBe('hero')
      const keys = page.blocks.map((b) => b._key)
      expect(new Set(keys).size).toBe(keys.length)
      page.blocks.forEach((b, i) => {
        const def = registry[b._type]
        if (def.placement === 'last') expect(i).toBe(page.blocks.length - 1)
        if (def.placement === 'first') expect(i).toBe(0)
        expect(page.blocks.filter((x) => x._type === b._type).length).toBeLessThanOrEqual(
          def.maxPerPage,
        )
        expect(blockSchema.safeParse(b).success).toBe(true)
      })
    },
  )

  it('covers the required pages', () => {
    const bySlug = Object.fromEntries(seedPages.map((p) => [p.slug, p.kind]))
    expect(bySlug).toMatchObject({
      home: 'home',
      platform: 'platform',
      'book-a-demo': 'page',
      refineries: 'industry',
      'power-grids': 'industry',
      'open-pit-mining': 'industry',
      'example-refinery-tank-inspection': 'landing',
    })
    for (const cs of facts.caseStudies) expect(bySlug[cs.slug]).toBe('caseStudy')
    expect(seedPages.find((p) => p.kind === 'landing')?.seo.noindex).toBe(true)
  })

  it('varies block composition between pages', () => {
    const sequences = seedPages.map((p) => p.blocks.map((b) => b._type).join(','))
    expect(new Set(sequences).size).toBe(sequences.length)
  })
})

describe('claims trace back to brand facts', () => {
  for (const page of seedPages) {
    describe(page.slug, () => {
      it('stats exist in facts', () => {
        for (const block of blocksOf(page, 'statsBand')) {
          for (const s of block.stats) {
            const match = facts.stats.find((f) => f.value === s.value && f.label === s.label)
            expect(match, `stat "${s.value} ${s.label}"`).toBeDefined()
            expect(s.unit).toBe(match?.unit)
            expect(s.basis).toBe(match?.basis)
          }
        }
      })

      it('operators exist in facts', () => {
        const names = facts.operators.map((o) => `${o.name}|${o.sector}`)
        for (const block of blocksOf(page, 'operatorStrip')) {
          for (const o of block.operators) expect(names).toContain(`${o.name}|${o.sector}`)
        }
      })

      it('case studies match facts', () => {
        for (const block of blocksOf(page, 'caseStudy')) {
          const cs = facts.caseStudies.find((c) => c.heading === block.heading)
          expect(cs, block.heading).toBeDefined()
          expect(block.operator).toBe(cs?.operator)
          expect(block.summary).toBe(cs?.summary)
          expect(block.metrics).toEqual(cs?.metrics)
          expect(block.quote).toEqual(cs?.quote)
          if (block.slug) expect(block.slug).toBe(cs?.slug)
        }
      })

      it('testimonials match facts', () => {
        for (const block of blocksOf(page, 'testimonial')) {
          const t = facts.testimonials.find((x) => x.text === block.text)
          expect(t, block.text).toBeDefined()
          expect([block.name, block.role, block.operator]).toEqual([t?.name, t?.role, t?.operator])
        }
      })

      it('integrations, compliance and FAQs match facts', () => {
        for (const block of blocksOf(page, 'integrations')) {
          for (const i of block.items) {
            expect(facts.integrations).toContainEqual(expect.objectContaining(i))
          }
        }
        for (const block of blocksOf(page, 'compliance')) {
          for (const c of block.items)
            expect(facts.compliance).toContainEqual(expect.objectContaining(c))
        }
        for (const block of blocksOf(page, 'faq')) {
          for (const q of block.items) expect(facts.faqs).toContainEqual(expect.objectContaining(q))
        }
      })

      it('use-case findings exist for their site type', () => {
        for (const block of blocksOf(page, 'useCaseTabs')) {
          for (const tab of block.tabs) {
            for (const f of tab.findings) {
              expect(facts.siteTypes[tab.siteType].typicalFindings).toContain(f)
            }
          }
        }
      })
    })
  }
})

describe('brand facts', () => {
  it('every case study and testimonial operator is a known operator', () => {
    const names = facts.operators.map((o) => o.name)
    for (const cs of facts.caseStudies) expect(names).toContain(cs.operator)
    for (const t of facts.testimonials) expect(names).toContain(t.operator)
  })

  it('has one case study per site type', () => {
    expect(facts.caseStudies.map((c) => c.siteType).sort()).toEqual(
      ['open-pit', 'refinery', 'substation'].sort(),
    )
  })

  it('covers port and solar-farm sites with assets, findings and route facts', () => {
    for (const site of ['port', 'solar-farm'] as const) {
      const s = facts.siteTypes[site]
      expect(s.assets.length).toBeGreaterThanOrEqual(5)
      expect(s.typicalFindings.length).toBeGreaterThanOrEqual(5)
      expect(s.routeFacts.length).toBeGreaterThanOrEqual(3)
    }
    const port = JSON.stringify(facts.siteTypes.port).toLowerCase()
    for (const term of ['perimeter', 'container', 'crane', 'berth', 'gate'])
      expect(port).toContain(term)
    const solar = JSON.stringify(facts.siteTypes['solar-farm']).toLowerCase()
    for (const term of ['string', 'hot cell', 'soiling', 'vegetation', 'inverter'])
      expect(solar).toContain(term)
  })

  it('has port security and solar capabilities and stats with an honest basis', () => {
    const caps = facts.capabilities.map((c) => c.id)
    expect(caps).toEqual(
      expect.arrayContaining([
        'perimeter-patrol',
        'after-hours-berths',
        'security-handoff',
        'string-thermal',
        'soiling-vegetation',
      ]),
    )
    for (const id of [
      'patrol-coverage',
      'night-patrols',
      'solar-survey-rate',
      'solar-faults-found',
    ]) {
      const stat = facts.stats.find((s) => s.id === id)
      expect(stat, id).toBeDefined()
      // A basis says where the number comes from: a period, a site set or a method.
      expect(stat!.basis).toMatch(/20\d\d|sites|flown/)
    }
  })

  it('ids are unique within each list', () => {
    const lists = [
      facts.capabilities,
      facts.specs,
      facts.stats,
      facts.operators,
      facts.caseStudies,
      facts.testimonials,
      facts.integrations,
      facts.compliance,
      facts.faqs,
    ]
    for (const list of lists) {
      const ids = list.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('voice', () => {
  const banned = facts.voice.bannedPhrases.map((p) => p.toLowerCase())
  const pattern = (phrase: string) =>
    new RegExp(
      `(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[’']/g, "['’]")}([^a-z]|$)`,
      'i',
    )

  it('no banned phrase appears in any seed page', () => {
    for (const page of seedPages) {
      const copy = [
        page.title,
        page.seo.title,
        page.seo.description,
        ...page.blocks.flatMap(copyFields),
      ]
      for (const text of copy) {
        for (const phrase of banned) {
          expect(pattern(phrase).test(text), `"${phrase}" in ${page.slug}: ${text}`).toBe(false)
        }
      }
    }
  })

  it('no banned phrase appears in the brand facts copy', () => {
    const { voice, ...rest } = facts
    void voice
    for (const text of strings(rest)) {
      for (const phrase of banned) {
        expect(pattern(phrase).test(text), `"${phrase}": ${text}`).toBe(false)
      }
    }
  })

  it('no exclamation marks in copy', () => {
    for (const page of seedPages) {
      for (const text of page.blocks.flatMap(copyFields)) expect(text).not.toContain('!')
    }
  })
})
