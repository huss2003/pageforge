/** Small text helpers shared by the writer, validator, fixer and fake model. */

/** Shorten to at most `max` chars at a word boundary, without trailing punctuation. */
export function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const cut = t.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  const base = (space > max * 0.5 ? cut.slice(0, space) : t.slice(0, max)).trim()
  return base
    .replace(/[\s,;:–—-]+$/u, '')
    .replace(/\b(and|or|the|a|an|to|of|for|with|in|on)$/i, '')
    .trim()
}

/** Keep whole sentences up to `max` chars; falls back to `clip` for one long sentence. */
export function clipSentences(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)/g)
  if (sentences) {
    let out = ''
    for (const s of sentences) {
      if ((out + s).trim().length > max) break
      out += s
    }
    if (out.trim()) return out.trim()
  }
  const c = clip(t, max - 1)
  return /[.!?]$/.test(c) ? c : `${c}.`
}

export function sentenceCase(text: string): string {
  const t = text.trim()
  return t ? t[0]!.toUpperCase() + t.slice(1) : t
}

export function joinList(items: string[], conj = 'and'): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`
  return `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`
}

export function slugify(text: string, max = 60): string {
  const s = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
  return clipSlug(s, max)
}

function clipSlug(s: string, max: number): string {
  if (s.length <= max) return s.replace(/^-+|-+$/g, '')
  const cut = s.slice(0, max)
  const dash = cut.lastIndexOf('-')
  return (dash > 10 ? cut.slice(0, dash) : cut).replace(/^-+|-+$/g, '')
}

/** Fields that hold identifiers or URLs rather than reader-facing copy. */
export const NON_COPY_FIELDS = new Set([
  '_key',
  '_type',
  '_id',
  'href',
  'slug',
  'siteType',
  'variant',
])

/** Visit every reader-facing string in a value, with its dotted path. */
export function walkCopy(
  value: unknown,
  visit: (text: string, path: string) => void,
  path = '',
): void {
  if (typeof value === 'string') {
    visit(value, path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkCopy(v, visit, path ? `${path}.${i}` : String(i)))
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (NON_COPY_FIELDS.has(k)) continue
      walkCopy(v, visit, path ? `${path}.${k}` : k)
    }
  }
}

/** Normalise for loose equality: case, quotes, dashes and whitespace. */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim()
}

/** Numeric tokens in a string: "38%", "4x", "6.4 km" → ["38", "4", "6.4"]. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,/g, ''))
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
