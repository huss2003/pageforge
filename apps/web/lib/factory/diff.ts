import type { Page } from '@pageforge/blocks'
import type { FixChange } from './types'

const MAX_CHANGES = 24

function walk(
  before: unknown,
  after: unknown,
  path: string,
  out: { field: string; before: string; after: string }[],
) {
  if (out.length >= MAX_CHANGES) return
  if (typeof before === 'string' || typeof after === 'string') {
    const b = typeof before === 'string' ? before : before == null ? '' : JSON.stringify(before)
    const a = typeof after === 'string' ? after : after == null ? '' : JSON.stringify(after)
    if (a !== b) out.push({ field: path, before: b, after: a })
    return
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    const b = Array.isArray(before) ? before : []
    const a = Array.isArray(after) ? after : []
    for (let i = 0; i < Math.max(a.length, b.length); i++) walk(b[i], a[i], `${path}[${i}]`, out)
    return
  }
  if (before && typeof before === 'object' && after && typeof after === 'object') {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const k of keys) {
      if (k === '_key' || k === '_type') continue
      walk(
        (before as Record<string, unknown>)[k],
        (after as Record<string, unknown>)[k],
        path ? `${path}.${k}` : k,
        out,
      )
    }
    return
  }
  if (before !== after) {
    out.push({
      field: path,
      before: before == null ? '' : String(before),
      after: after == null ? '' : String(after),
    })
  }
}

/** Text-level changes between two versions of a page, keyed by block. */
export function diffPages(before: Page, after: Page): FixChange[] {
  const changes: FixChange[] = []
  const meta: { field: string; before: string; after: string }[] = []
  walk({ title: before.title, seo: before.seo }, { title: after.title, seo: after.seo }, '', meta)
  for (const m of meta) changes.push({ blockKey: null, blockType: null, ...m })

  const afterByKey = new Map(after.blocks.map((b) => [b._key, b]))
  const beforeKeys = new Set(before.blocks.map((b) => b._key))
  for (const b of before.blocks) {
    const a = afterByKey.get(b._key)
    if (!a) {
      changes.push({
        blockKey: b._key,
        blockType: b._type,
        field: '(block)',
        before: b._type,
        after: 'removed',
      })
      continue
    }
    const out: { field: string; before: string; after: string }[] = []
    walk(b, a, '', out)
    for (const o of out) changes.push({ blockKey: b._key, blockType: b._type, ...o })
  }
  for (const a of after.blocks) {
    if (!beforeKeys.has(a._key))
      changes.push({
        blockKey: a._key,
        blockType: a._type,
        field: '(block)',
        before: 'none',
        after: `added ${a._type}`,
      })
  }
  return changes.slice(0, MAX_CHANGES)
}
