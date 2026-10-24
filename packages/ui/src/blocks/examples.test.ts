import { describe, expect, it } from 'vitest'
import { blockKinds, blockSchema, pageSchema, registry } from '@pageforge/blocks'
import { allExamples, examplePage, examples } from './examples'

describe('block examples', () => {
  it('has an example for every block kind', () => {
    expect(Object.keys(examples).sort()).toEqual([...blockKinds].sort())
  })

  it.each(allExamples.map((b) => [`${b._type} (${b._key})`, b] as const))(
    '%s parses with blockSchema',
    (_name, block) => {
      const result = blockSchema.safeParse(block)
      if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2))
      expect(result.data).toEqual(block)
    },
  )

  it('covers all three hero variants', () => {
    const variants = allExamples.flatMap((b) => (b._type === 'hero' ? [b.variant] : []))
    expect(variants.sort()).toEqual(['route', 'split', 'statement'])
  })
})

describe('example page', () => {
  it('is a valid page', () => {
    const result = pageSchema.safeParse({
      kind: 'home',
      title: 'Hoverline',
      slug: 'home',
      seo: {
        title: 'Hoverline: drone inspection for refineries, grids and mines',
        description:
          'Docked drones fly your site every shift and turn what they see into work orders.',
      },
      blocks: examplePage,
    })
    if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2))
  })

  it('follows the registry placement and per-page limits', () => {
    const counts = new Map<string, number>()
    examplePage.forEach((b, i) => {
      counts.set(b._type, (counts.get(b._type) ?? 0) + 1)
      const def = registry[b._type]
      if (def.placement === 'first') expect(i).toBe(0)
      if (def.placement === 'last') expect(i).toBe(examplePage.length - 1)
    })
    for (const [kind, n] of counts) {
      expect(n).toBeLessThanOrEqual(registry[kind as keyof typeof registry].maxPerPage)
    }
  })

  it('uses unique block keys', () => {
    const keys = examplePage.map((b) => b._key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
