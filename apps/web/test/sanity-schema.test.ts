import { describe, expect, it } from 'vitest'
import { blockKinds, blockSchema, pageSchema } from '@pageforge/blocks'
import { blockTypes } from '@/sanity/schemaTypes/blocks'
import { page } from '@/sanity/schemaTypes/page'
import { toSanityDocument } from '@/sanity/lib/documents'
import { seedPages } from '@pageforge/content'
import { z } from 'zod'

/**
 * Guards the "Studio mirrors zod" promise: every block has a Sanity type,
 * field names match the zod shape, and string limits match max lengths.
 */
type Field = { name: string; type: string; fields?: Field[]; of?: Field[]; validation?: unknown }

function zodShape(kind: string) {
  const option = blockSchema.options.find((o) => o.shape._type.value === kind)
  if (!option) throw new Error(kind)
  return option.shape as Record<string, z.ZodType>
}

function maxLength(schema: z.ZodType): number | undefined {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as {
    maxLength?: number
  }
  return json.maxLength
}

/** Runs a Sanity validation builder against a recording rule to read .max(n). */
function sanityMax(field: Field): number | undefined {
  if (typeof field.validation !== 'function') return undefined
  let max: number | undefined
  const rule: Record<string, unknown> = {}
  const chain = new Proxy(rule, {
    get:
      (_t, prop) =>
      (...args: unknown[]) => {
        if (prop === 'max') max = args[0] as number
        return chain
      },
  })
  ;(field.validation as (r: unknown) => unknown)(chain)
  return max
}

describe('Sanity block schemas mirror the zod contract', () => {
  it('has one Sanity object type per block kind', () => {
    expect(blockTypes.map((t) => t.name).sort()).toEqual([...blockKinds].sort())
  })

  for (const type of blockTypes) {
    it(`${type.name}: same fields and string limits`, () => {
      const shape = zodShape(type.name)
      const zodKeys = Object.keys(shape).filter((k) => k !== '_key' && k !== '_type')
      const fields = (type as unknown as { fields: Field[] }).fields
      expect(fields.map((f) => f.name).sort()).toEqual(zodKeys.sort())
      for (const field of fields) {
        if (field.type === 'string' || field.type === 'text') {
          const zMax = maxLength(shape[field.name]!)
          if (zMax) expect(sanityMax(field), `${type.name}.${field.name}`).toBe(zMax)
        }
      }
    })
  }

  it('page document has the pageSchema fields', () => {
    const names = (page as unknown as { fields: Field[] }).fields.map((f) => f.name).sort()
    expect(names).toEqual(
      Object.keys(pageSchema.shape)
        .filter((k) => k !== '_id')
        .sort(),
    )
  })
})

describe('seed script', () => {
  it('maps every seed page to a deterministic, public document id', () => {
    const docs = seedPages.map(toSanityDocument)
    for (const doc of docs) {
      expect(doc._id).toMatch(/^page-[a-z0-9-]+$/)
      expect(doc._id).not.toContain('.')
      expect(doc._type).toBe('page')
    }
    expect(new Set(docs.map((d) => d._id)).size).toBe(docs.length)
  })

  it('round-trips: a seeded document read back by GROQ parses with pageSchema', () => {
    for (const doc of seedPages.map(toSanityDocument)) {
      // What PAGE_QUERY returns: slug flattened, everything else as stored.
      const { slug, _type, ...rest } = doc
      void _type
      expect(pageSchema.safeParse({ ...rest, slug: slug.current }).success).toBe(true)
    }
  })
})
