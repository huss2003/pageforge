import { z } from 'zod'
import { blockSchema, type BlockKind } from '@pageforge/blocks'

/**
 * Compact, TypeScript-like shape of each block, generated from the zod
 * schemas so prompts never drift from the contract. Example:
 *   hero {variant:"route"|"statement"|"split", heading:str≤90, ...}
 */
const cache = new Map<BlockKind, string>()

export function blockShape(kind: BlockKind): string {
  const hit = cache.get(kind)
  if (hit) return hit
  const option = blockSchema.options.find((o) => o.shape._type.value === kind)
  if (!option) throw new Error(`Unknown block kind ${kind}`)
  const json = z.toJSONSchema(option, { io: 'input', unrepresentable: 'any' }) as JsonNode
  const props = { ...(json.properties ?? {}) }
  delete props._key
  delete props._type
  const shape = `${kind} ${describe({ ...json, properties: props })}`
  cache.set(kind, shape)
  return shape
}

export function blockShapes(kinds: BlockKind[]): string {
  return [...new Set(kinds)].map((k) => `- ${blockShape(k)}`).join('\n')
}

interface JsonNode {
  type?: string | string[]
  properties?: Record<string, JsonNode>
  required?: string[]
  items?: JsonNode
  enum?: unknown[]
  const?: unknown
  anyOf?: JsonNode[]
  oneOf?: JsonNode[]
  maxLength?: number
  minItems?: number
  maxItems?: number
  default?: unknown
}

function describe(n: JsonNode): string {
  if (n.const !== undefined) return JSON.stringify(n.const)
  if (n.enum) return n.enum.map((v) => JSON.stringify(v)).join('|')
  const union = n.anyOf ?? n.oneOf
  if (union) return union.map(describe).join('|')
  if (n.type === 'object' || n.properties) {
    const req = new Set(n.required ?? [])
    const fields = Object.entries(n.properties ?? {}).map(
      ([k, v]) => `${k}${req.has(k) || v.default !== undefined ? '' : '?'}:${describe(v)}`,
    )
    return `{${fields.join(', ')}}`
  }
  if (n.type === 'array') {
    const range =
      n.minItems !== undefined || n.maxItems !== undefined
        ? `(${n.minItems ?? 0}-${n.maxItems ?? 'n'})`
        : ''
    return `[${describe(n.items ?? {})}]${range}`
  }
  if (n.type === 'string') return n.maxLength ? `str≤${n.maxLength}` : 'str'
  if (n.type === 'boolean') return 'bool'
  if (n.type === 'number' || n.type === 'integer') return 'num'
  return 'any'
}
