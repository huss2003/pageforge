/**
 * Text and field-path helpers for claims: sentence spans, number tokens
 * (digits and number words), and "stats[1].value"-style paths into blocks.
 */

export interface Span {
  start: number
  end: number
  text: string
}

const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'st',
  'no',
  'inc',
  'ltd',
  'co',
  'corp',
  'e.g',
  'i.e',
  'etc',
  'approx',
  'vs',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
  'u.s',
])

/** Sentence spans of `text` (offsets into the original string). */
export function sentenceSpans(text: string): Span[] {
  const spans: Span[] = []
  const re = /[.!?]+["'”’)]*(?=\s+|$)/g
  let start = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length
    const before = text.slice(start, m.index)
    const lastWord = /([A-Za-z.]+)$/.exec(before)?.[1]?.toLowerCase() ?? ''
    // "No. 4 berth", "e.g. cranes": not a sentence end.
    if (m[0] === '.' && ABBREVIATIONS.has(lastWord.replace(/\.$/, ''))) continue
    // Next sentence must start with an upper-case letter, digit or quote.
    const next = text.slice(end).trimStart()[0]
    if (next && !/[A-Z0-9"“'‘(]/.test(next)) continue
    pushSpan(spans, text, start, end)
    start = end
  }
  if (start < text.length) pushSpan(spans, text, start, text.length)
  return spans
}

function pushSpan(spans: Span[], text: string, start: number, end: number) {
  const raw = text.slice(start, end)
  const lead = raw.length - raw.trimStart().length
  const trimmed = raw.trim()
  if (trimmed)
    spans.push({ start: start + lead, end: start + lead + trimmed.length, text: trimmed })
}

export function splitSentences(text: string): string[] {
  return sentenceSpans(text).map((s) => s.text)
}

const NUMBER_WORDS: Record<string, string> = {
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  sixty: '60',
  seventy: '70',
  eighty: '80',
  ninety: '90',
  hundred: '100',
  thousand: '1000',
  million: '1000000',
  billion: '1000000000',
  dozen: '12',
}

/**
 * Canonical number tokens in a text: "1,100" → "1100", "four" → "4".
 * "one" is not counted: it is mostly a pronoun ("no one", "one dock").
 */
export function numberTokens(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\d+(?:[.,]\d+)*/g)) out.push(m[0].replace(/,(?=\d{3}\b)/g, ''))
  for (const m of text.toLowerCase().matchAll(/\b[a-z]+\b/g)) {
    const n = NUMBER_WORDS[m[0]]
    if (n) out.push(n)
  }
  return out.map((n) => n.replace(/^0+(?=\d)/, '').replace(/,/g, '.'))
}

export function hasNumber(text: string): boolean {
  return numberTokens(text).length > 0
}

/** Lower-case, unify quotes and dashes, collapse whitespace. */
export function loose(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Loose containment that also ignores spacing ("71 %" vs "71%") and final punctuation. */
export function looseIncludes(haystack: string, needle: string): boolean {
  const h = loose(haystack)
  const n = loose(needle).replace(/[.!?;:,]+$/, '')
  if (!n) return false
  if (h.includes(n)) return true
  const strip = (s: string) => s.replace(/[\s"'.,;:!?()]/g, '')
  return strip(h).includes(strip(n))
}

const STOPWORDS = new Set(
  'about above after again against also among and any are around because been before being below between both but can could does doing down during each every few from further have having here into its itself just more most much must near need only other ours over same should some such than that their them then there these they this those through under until very were what when where which while will with within without would your yours across along runs uses used using each well like make made'.split(
    ' ',
  ),
)

/** Content words (≥ 4 letters, not stopwords) for term-overlap checks. */
export function contentWords(text: string): string[] {
  return (loose(text).match(/[a-z][a-z'-]{3,}/g) ?? []).filter((w) => !STOPWORDS.has(w))
}

/** Share of `claim` content words that appear (by 5-letter stem) in `source`. */
export function termOverlap(claim: string, source: string): number {
  const words = [...new Set(contentWords(claim))]
  if (words.length === 0) return 1
  const stems = new Set(contentWords(source).map((w) => w.slice(0, 5)))
  const hit = words.filter((w) => stems.has(w.slice(0, 5))).length
  return hit / words.length
}

// ---------------------------------------------------------------------------
// Field paths: "heading", "stats[1].value", "tabs[0].findings[2]"
// ---------------------------------------------------------------------------

export type PathPart = string | number

export function parsePath(path: string): PathPart[] {
  const parts: PathPart[] = []
  for (const m of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    if (m[2] !== undefined) parts.push(Number(m[2]))
    else if (m[1] !== undefined) parts.push(/^\d+$/.test(m[1]) ? Number(m[1]) : m[1])
  }
  return parts
}

export function formatPath(parts: PathPart[]): string {
  return parts.map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? p : `.${p}`)).join('')
}

export function getAt(value: unknown, path: string | PathPart[]): unknown {
  const parts = typeof path === 'string' ? parsePath(path) : path
  let cur: unknown = value
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[p]
  }
  return cur
}

/** Set a value at a path that already exists (no auto-created containers). Returns false if missing. */
export function setAt(value: unknown, path: string | PathPart[], next: unknown): boolean {
  const parts = typeof path === 'string' ? parsePath(path) : path
  if (parts.length === 0) return false
  const parent = getAt(value, parts.slice(0, -1))
  if (parent === null || typeof parent !== 'object') return false
  const last = parts[parts.length - 1]!
  if (Array.isArray(parent)) {
    if (typeof last !== 'number' || last < 0 || last >= parent.length) return false
    parent[last] = next
    return true
  }
  ;(parent as Record<string, unknown>)[last as string] = next
  return true
}

export function deleteAt(value: unknown, path: string | PathPart[]): boolean {
  const parts = typeof path === 'string' ? parsePath(path) : path
  const parent = getAt(value, parts.slice(0, -1))
  if (parent === null || typeof parent !== 'object') return false
  const last = parts[parts.length - 1]!
  if (Array.isArray(parent)) {
    if (typeof last !== 'number' || last >= parent.length) return false
    parent.splice(last, 1)
    return true
  }
  if (!(last in (parent as object))) return false
  delete (parent as Record<string, unknown>)[last as string]
  return true
}

/** The claim's unit of copy: the path up to and including the first array index. */
export function fieldRoot(path: string): string {
  const parts = parsePath(path)
  const i = parts.findIndex((p) => typeof p === 'number')
  return formatPath(i === -1 ? parts : parts.slice(0, i + 1))
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

/** Every reader-facing string under a value, with its path. */
export function copyEntries(
  value: unknown,
  base: PathPart[] = [],
): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = []
  const walk = (v: unknown, parts: PathPart[]) => {
    if (typeof v === 'string') {
      if (parts.length) out.push({ field: formatPath(parts), text: v })
      return
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, [...parts, i]))
      return
    }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (NON_COPY_FIELDS.has(k)) continue
        walk(x, [...parts, k])
      }
    }
  }
  walk(value, base)
  return out
}

/** All copy under a field root joined with spaces (for stats: value, unit, label, basis). */
export function textUnder(block: unknown, root: string): string {
  const v = getAt(block, root)
  if (typeof v === 'string') return v
  return copyEntries(v)
    .map((e) => e.text)
    .join(' ')
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
