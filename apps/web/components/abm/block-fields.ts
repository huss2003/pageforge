import { blockSchema, type Block } from '@pageforge/blocks'
import { fieldLabel } from './labels'

/**
 * Editable fields for one block, read from the block's zod schema so the
 * editor never drifts from the registry. Strings become text inputs (a
 * textarea past 120 characters), enums become selects. Optional objects
 * that are absent, booleans and unions are left out: the editor changes
 * copy, not structure.
 */
export interface EditableField {
  path: string
  label: string
  kind: 'text' | 'textarea' | 'select'
  max?: number
  options?: string[]
  optional: boolean
  value: string
}

interface ZodLike {
  def: { type: string; innerType?: ZodLike; element?: ZodLike }
  shape?: Record<string, ZodLike>
  maxLength?: number | null
  options?: unknown[]
}

function schemaFor(type: Block['_type']): ZodLike | null {
  const opt = (blockSchema.options as unknown as { shape: Record<string, ZodLike> }[]).find(
    (o) => (o.shape._type as unknown as { value: string }).value === type,
  )
  return (opt as unknown as ZodLike) ?? null
}

function walk(
  s: ZodLike,
  value: unknown,
  path: string,
  optional: boolean,
  out: EditableField[],
): void {
  const t = s.def.type
  if ((t === 'optional' || t === 'default') && s.def.innerType) {
    walk(s.def.innerType, value, path, optional || t === 'optional', out)
    return
  }
  if (t === 'string') {
    // An absent optional string is still listed, so it can be written.
    const max = typeof s.maxLength === 'number' ? s.maxLength : undefined
    out.push({
      path,
      label: fieldLabel(path),
      kind: max && max > 120 ? 'textarea' : 'text',
      max,
      optional,
      value: typeof value === 'string' ? value : '',
    })
    return
  }
  if (t === 'enum') {
    out.push({
      path,
      label: fieldLabel(path),
      kind: 'select',
      options: (s.options ?? []).map(String),
      optional,
      value: typeof value === 'string' ? value : '',
    })
    return
  }
  if (t === 'object' && s.shape) {
    if (value === undefined || value === null) return
    for (const [key, child] of Object.entries(s.shape)) {
      walk(
        child,
        (value as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key,
        false,
        out,
      )
    }
    return
  }
  if (t === 'array' && s.def.element && Array.isArray(value)) {
    value.forEach((item, i) => walk(s.def.element!, item, `${path}[${i}]`, false, out))
  }
}

export function editableFields(block: Block): EditableField[] {
  const schema = schemaFor(block._type)
  if (!schema?.shape) return []
  const out: EditableField[] = []
  for (const [key, child] of Object.entries(schema.shape)) {
    if (key === '_key' || key === '_type') continue
    walk(child, (block as Record<string, unknown>)[key], key, false, out)
  }
  return out
}

/** Read "stats[1].value" out of a block. */
export function readField(block: Block, path: string): unknown {
  let cur: unknown = block
  for (const seg of path.split('.')) {
    const m = /^([A-Za-z_]+)(?:\[(\d+)\])?$/.exec(seg)
    if (!m || cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[m[1]!]
    if (m[2] !== undefined) {
      if (!Array.isArray(cur)) return undefined
      cur = cur[Number(m[2])]
    }
  }
  return cur
}

/** Immutable write of "stats[1].value" into a block. */
export function writeField<T extends Block>(block: T, path: string, value: unknown): T {
  const segs = path.split('.').flatMap((seg) => {
    const m = /^([A-Za-z_]+)(?:\[(\d+)\])?$/.exec(seg)
    if (!m) return []
    return m[2] !== undefined ? [m[1]!, Number(m[2])] : [m[1]!]
  })
  const set = (obj: unknown, i: number): unknown => {
    if (i === segs.length) return value
    const key = segs[i]!
    if (typeof key === 'number') {
      const arr = Array.isArray(obj) ? [...obj] : []
      arr[key] = set(arr[key], i + 1)
      return arr
    }
    const o = obj && typeof obj === 'object' ? { ...(obj as Record<string, unknown>) } : {}
    o[key] = set(o[key], i + 1)
    return o
  }
  return set(block, 0) as T
}
