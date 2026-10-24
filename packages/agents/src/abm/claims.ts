import { blockSchema, pageSchema, type Block, type Page } from '@pageforge/blocks'
import {
  copyEntries,
  deleteAt,
  escapeRegExp,
  fieldRoot,
  formatPath,
  getAt,
  looseIncludes,
  numberTokens,
  parsePath,
  sentenceSpans,
  setAt,
  termOverlap,
  textUnder,
  type PathPart,
} from './text'
import type {
  AccountFact,
  CheckableClaim,
  ClaimCheck,
  ClaimKind,
  DraftClaim,
  ProductFact,
} from './types'

export interface ValidateClaimsOptions {
  productFacts: ProductFact[]
  /** Included account facts only: excluded facts are not valid sources. */
  accountFacts: AccountFact[]
  bannedPhrases: string[]
  /** Hoverline operator names: a customer name in copy must be sourced. */
  customerNames?: string[]
  /** Certification names from the brand facts. */
  certificationNames?: string[]
  /** The target account's name, used to label auto-created claims. */
  accountName?: string
}

export interface UnsourcedClaim {
  claim: DraftClaim
  check: ClaimCheck
}

export interface ClaimsValidation {
  /** One check per input claim, same order. */
  checks: ClaimCheck[]
  /** "Unsourced statement" claims for sensitive copy no claim covers. */
  unsourced: UnsourcedClaim[]
  /** Version-level problems: banned phrases, schema and structure errors. */
  pageIssues: string[]
}

/** Generic certification words that need a source even when not a known name. */
const CERT_PATTERN =
  /\b(ISO(?:\/IEC)?\s?\d{3,5}|SOC\s?2(?:\s?Type\s?(?:I|II))?|NERC(?:\s?CIP)?|Part\s?107|ATEX|IECEx|certified|certification|accredited|accreditation)\b/gi

/** Minimum share of an account claim's key terms that must be in its quote(s). */
export const ACCOUNT_TERM_OVERLAP = 0.5

/**
 * Deterministic claim validator (spec §4). Runs after every draft and edit.
 *
 * - product_fact: cites ≥ 1 existing product fact; every number in the
 *   claim appears in the cited facts.
 * - account_fact: cites ≥ 1 included source fact; numbers appear in the
 *   quotes and at least half of the key terms do.
 * - positioning: needs no source but may not contain numbers, customer
 *   names or certifications.
 * - Any number, money amount, percentage, customer name or certification in
 *   the copy that no claim covers becomes an "Unsourced statement" claim.
 * - Banned phrases and schema problems are page-level issues.
 */
export function validateClaims(
  page: Page,
  claims: CheckableClaim[],
  opts: ValidateClaimsOptions,
): ClaimsValidation {
  const productById = new Map(opts.productFacts.map((f) => [f.id, f]))
  const accountById = new Map(opts.accountFacts.map((f) => [f.id, f]))
  const blocks = new Map(page.blocks.map((b) => [b._key, b]))
  const names = opts.customerNames ?? []
  const certs = opts.certificationNames ?? []

  const checks = claims.map((c) =>
    checkClaim(c, blocks.get(c.blockKey), { productById, accountById, names, certs }),
  )

  const live = claims.filter((c) => c.status !== 'rejected')
  // Text of the facts each valid claim cites: a number in a sibling field of
  // the same item (stats[0].value next to a claim on stats[0].basis) is
  // covered when that claim's cited fact contains it.
  const citedText = new Map<CheckableClaim, string>()
  claims.forEach((c, i) => {
    if (c.status === 'rejected' || !checks[i]!.ok) return
    const parts = c.sources.map((s) =>
      s.type === 'product_fact'
        ? (productById.get(s.factId)?.text ?? '')
        : (accountById.get(s.sourceFactId)?.quote ?? ''),
    )
    citedText.set(c, parts.join(' '))
  })
  const unsourced: UnsourcedClaim[] = []
  const seen = new Set<string>()
  for (const block of page.blocks) {
    for (const entry of copyEntries(block)) {
      for (const token of sensitiveTokens(entry.text, names, certs)) {
        const root = fieldRoot(entry.field)
        const covered =
          live.some(
            (c) =>
              c.blockKey === block._key &&
              fieldRoot(c.field) === root &&
              (tokenIn(token, c.text) || tokenIn(token, citedText.get(c) ?? '')),
          ) ||
          unsourced.some(
            (u) =>
              u.claim.blockKey === block._key &&
              fieldRoot(u.claim.field) === root &&
              tokenIn(token, u.claim.text),
          )
        if (covered) continue
        const text = sentenceWith(entry.text, token)
        const id = `${block._key}|${entry.field}|${text}`
        if (seen.has(id)) continue
        seen.add(id)
        const kind: ClaimKind =
          opts.accountName && looseIncludes(text, opts.accountName)
            ? 'account_fact'
            : 'product_fact'
        unsourced.push({
          claim: {
            blockKey: block._key,
            field: entry.field,
            text,
            kind,
            sources: [],
            origin: 'validator',
          },
          check: {
            ok: false,
            reasons: [
              `Unsourced statement: ${describeToken(token)} in ${block._type}.${entry.field} is not covered by a sourced claim.`,
            ],
          },
        })
      }
    }
  }

  return { checks, unsourced, pageIssues: pageIssues(page, opts.bannedPhrases) }
}

interface CheckCtx {
  productById: Map<string, ProductFact>
  accountById: Map<string, AccountFact>
  names: string[]
  certs: string[]
}

export function checkClaim(
  claim: CheckableClaim,
  block: Block | undefined,
  ctx: CheckCtx,
): ClaimCheck {
  const reasons: string[] = []
  const text = claim.text.trim()
  if (!text) reasons.push('The claim has no text.')
  if (!block) {
    reasons.push(`Block "${claim.blockKey}" is not on the page.`)
  } else if (text) {
    const where = textUnder(block, fieldRoot(claim.field))
    const nums = numberTokens(text)
    const whereNums = new Set(numberTokens(where))
    const loosely =
      nums.every((n) => whereNums.has(n)) && termOverlap(text, where) >= 0.8 && where.length > 0
    if (!looseIncludes(where, text) && !loosely) {
      reasons.push(`The claim text does not appear in ${claim.field}.`)
    }
  }
  for (const id of claim.unresolved ?? [])
    reasons.push(`Cites "${id}", which is not an approved fact.`)

  const numbers = [...new Set(numberTokens(text))]
  const namesIn = ctx.names.filter((n) => looseIncludes(text, n))
  const certsIn = [
    ...ctx.certs.filter((n) => looseIncludes(text, n)),
    ...[...text.matchAll(CERT_PATTERN)].map((m) => m[0]),
  ]

  if (claim.kind === 'positioning') {
    if (numbers.length)
      reasons.push(
        `Positioning cannot contain numbers (${numbers.join(', ')}); cite a fact instead.`,
      )
    if (namesIn.length) reasons.push(`Positioning cannot name customers (${namesIn.join(', ')}).`)
    if (certsIn.length)
      reasons.push(
        `Positioning cannot mention certifications (${[...new Set(certsIn)].join(', ')}).`,
      )
    return { ok: reasons.length === 0, reasons }
  }

  const sourceTexts: string[] = []
  const quotes: string[] = []
  let productCount = 0
  let accountCount = 0
  for (const s of claim.sources) {
    if (s.type === 'product_fact') {
      const f = ctx.productById.get(s.factId)
      if (!f) reasons.push(`Cites "${s.factId}", which is not an approved Hoverline fact.`)
      else {
        productCount++
        sourceTexts.push(f.text)
      }
    } else {
      const f = ctx.accountById.get(s.sourceFactId)
      if (!f) reasons.push('Cites an account source that is excluded or no longer exists.')
      else {
        accountCount++
        sourceTexts.push(f.quote)
        quotes.push(f.quote)
      }
    }
  }

  if (claim.kind === 'product_fact' && productCount === 0)
    reasons.push('No approved Hoverline fact is cited.')
  if (claim.kind === 'account_fact' && accountCount === 0)
    reasons.push('No included public source is cited.')

  const sourceNumbers = new Set(sourceTexts.flatMap(numberTokens))
  const missing = numbers.filter((n) => !sourceNumbers.has(n))
  if (missing.length && sourceTexts.length)
    reasons.push(`Number ${missing.join(', ')} does not appear in the cited source.`)
  else if (missing.length) reasons.push(`Number ${missing.join(', ')} has no source.`)

  const joined = sourceTexts.join(' ')
  for (const n of namesIn)
    if (!looseIncludes(joined, n)) reasons.push(`Customer "${n}" is not in the cited source.`)
  for (const c of new Set(certsIn))
    if (!looseIncludes(joined, c)) reasons.push(`"${c}" is not in the cited source.`)

  if (claim.kind === 'account_fact' && quotes.length) {
    const overlap = termOverlap(text, quotes.join(' '))
    if (overlap < ACCOUNT_TERM_OVERLAP)
      reasons.push('Key terms in the claim are not in the quoted source.')
  }
  return { ok: reasons.length === 0, reasons }
}

// ---------------------------------------------------------------------------
// Sensitive tokens
// ---------------------------------------------------------------------------

type Token =
  | { type: 'number'; value: string; display: string }
  | { type: 'customer' | 'certification'; value: string; display: string }

function sensitiveTokens(text: string, names: string[], certs: string[]): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(
    /([$€£₹]\s?)?\d+(?:[.,]\d+)*(\s?%|\s?(?:million|billion|bn|m|k)\b)?/gi,
  )) {
    for (const n of numberTokens(m[0])) out.push({ type: 'number', value: n, display: m[0].trim() })
  }
  for (const m of text.toLowerCase().matchAll(/\b[a-z]+\b/g)) {
    const n = numberTokens(m[0])[0]
    if (n && !/\d/.test(m[0])) out.push({ type: 'number', value: n, display: m[0] })
  }
  for (const n of names)
    if (looseIncludes(text, n)) out.push({ type: 'customer', value: n, display: n })
  for (const c of certs)
    if (looseIncludes(text, c)) out.push({ type: 'certification', value: c, display: c })
  for (const m of text.matchAll(CERT_PATTERN))
    out.push({ type: 'certification', value: m[0], display: m[0] })
  return out
}

function tokenIn(token: Token, text: string): boolean {
  if (token.type === 'number') return numberTokens(text).includes(token.value)
  return looseIncludes(text, token.value)
}

function describeToken(t: Token): string {
  if (t.type === 'number') return `"${t.display}"`
  return t.type === 'customer' ? `customer name "${t.display}"` : `certification "${t.display}"`
}

function sentenceWith(text: string, token: Token): string {
  const spans = sentenceSpans(text)
  return (spans.find((s) => tokenIn(token, s.text)) ?? spans[0])?.text ?? text
}

// ---------------------------------------------------------------------------
// Page-level checks
// ---------------------------------------------------------------------------

export function bannedPhraseHits(text: string, banned: string[]): string[] {
  return banned
    .filter((p) => p.trim())
    .filter((p) =>
      new RegExp(
        `(^|[^\\p{L}\\p{N}])${escapeRegExp(p.trim()).replace(/[’']/g, "['’]")}(?:s|es|d|ed|ing)?(?=$|[^\\p{L}\\p{N}])`,
        'iu',
      ).test(text),
    )
}

export function pageIssues(page: Page, bannedPhrases: string[]): string[] {
  const issues: string[] = []
  const parsed = pageSchema.safeParse(page)
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 20)) {
      const [head, index, ...rest] = i.path
      if (head === 'blocks' && typeof index === 'number') {
        const b = page.blocks[index]
        issues.push(
          `Block ${b?._key ?? index + 1} (${b?._type ?? 'unknown'}) ${formatPath(rest as PathPart[]) || 'block'}: ${humanZod(i.message)}`,
        )
      } else issues.push(`${i.path.join('.') || 'page'}: ${humanZod(i.message)}`)
    }
  }
  if (page.blocks[0]?._type !== 'hero') issues.push('The first block must be a hero.')
  const copy = [
    { where: 'title', text: page.title },
    { where: 'seo.title', text: page.seo?.title ?? '' },
    { where: 'seo.description', text: page.seo?.description ?? '' },
    ...page.blocks.flatMap((b) =>
      copyEntries(b).map((e) => ({ where: `${b._key}.${e.field}`, text: e.text })),
    ),
  ]
  for (const { where, text } of copy)
    for (const hit of bannedPhraseHits(text, bannedPhrases))
      issues.push(`Banned phrase "${hit}" in ${where}.`)
  return issues
}

function humanZod(message: string): string {
  return message
    .replace(
      /^Too big: expected string to have <=(\d+) characters$/,
      'must be at most $1 characters',
    )
    .replace(/^Too small: expected string to have >=1 characters$/, 'must not be empty')
    .replace(/^Too big: expected array to have <=(\d+) items$/, 'must have at most $1 items')
    .replace(/^Too small: expected array to have >=(\d+) items$/, 'must have at least $1 items')
}

// ---------------------------------------------------------------------------
// Removing rejected claims
// ---------------------------------------------------------------------------

export interface RemovalResult<C extends CheckableClaim> {
  page: Page
  /** Claims with field paths updated for removed array items. */
  claims: C[]
  /** Blocks removed because every claim in them was rejected. */
  removedBlocks: string[]
  /** Required fields left empty or under-filled; the version cannot be approved until edited. */
  emptyFields: string[]
  changed: boolean
}

/** Blocks the page cannot lose: they are edited instead of removed. */
const STRUCTURAL = new Set(['hero', 'demoForm', 'ctaBand'])

/**
 * Remove every rejected claim from the copy: delete the sentence(s) that
 * contain it, the list item when a sentence was all the item had, or the
 * whole block when every claim in it was rejected (spec §2.5).
 */
export function removeRejectedClaims<C extends CheckableClaim>(
  input: Page,
  claims: C[],
): RemovalResult<C> {
  const page = structuredClone(input)
  const out = claims.map((c) => ({ ...c }))
  const removedBlocks: string[] = []
  const emptyFields: string[] = []
  let changed = false

  const byBlock = new Map<string, C[]>()
  for (const c of out) {
    if (!byBlock.has(c.blockKey)) byBlock.set(c.blockKey, [])
    byBlock.get(c.blockKey)!.push(c)
  }

  for (const [key, blockClaims] of byBlock) {
    const rejected = blockClaims.filter((c) => c.status === 'rejected')
    if (!rejected.length) continue
    const index = page.blocks.findIndex((b) => b._key === key)
    if (index === -1) continue
    const block = page.blocks[index]!
    if (rejected.length === blockClaims.length && !STRUCTURAL.has(block._type)) {
      page.blocks.splice(index, 1)
      removedBlocks.push(key)
      changed = true
      continue
    }

    const itemDeletes: { array: PathPart[]; index: number }[] = []
    const markEmpty = (parts: PathPart[]) => {
      const i = parts.findIndex((p) => typeof p === 'number')
      if (i !== -1) {
        itemDeletes.push({ array: parts.slice(0, i), index: parts[i] as number })
        return
      }
      // Optional field: drop it. Required: leave empty and report.
      const trial = structuredClone(block)
      deleteAt(trial, parts)
      if (issuesAt(trial, parts)) {
        setAt(block, parts, '')
        emptyFields.push(`${key}.${formatPath(parts)}`)
      } else deleteAt(block, parts)
    }

    for (const claim of rejected) {
      const parts = parsePath(claim.field)
      const value = getAt(block, parts)
      if (typeof value === 'string') {
        const next = removeSentences(value, claim.text)
        if (next === value) continue
        changed = true
        if (next) setAt(block, parts, next)
        else markEmpty(parts)
      } else if (value !== undefined) {
        changed = true
        markEmpty(parsePath(fieldRoot(claim.field)))
      }
    }

    // Delete list items from the highest index down, re-pointing later claims.
    itemDeletes.sort((a, b) => b.index - a.index)
    const done = new Set<string>()
    for (const d of itemDeletes) {
      const arrayPath = formatPath(d.array)
      const id = `${arrayPath}[${d.index}]`
      if (done.has(id)) continue
      done.add(id)
      const arr = getAt(block, d.array)
      if (!Array.isArray(arr) || d.index >= arr.length) continue
      arr.splice(d.index, 1)
      for (const c of blockClaims) {
        const p = parsePath(c.field)
        const prefix = p.slice(0, d.array.length)
        const at = p[d.array.length]
        if (formatPath(prefix) === arrayPath && typeof at === 'number' && at > d.index) {
          p[d.array.length] = at - 1
          c.field = formatPath(p)
        }
      }
    }
  }

  const parsed = pageSchema.safeParse(page)
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      const [head, idx, ...rest] = i.path
      if (head !== 'blocks' || typeof idx !== 'number') continue
      const where = `${page.blocks[idx]?._key ?? idx}.${formatPath(rest as PathPart[])}`
      if (!emptyFields.includes(where)) emptyFields.push(where)
    }
  }
  return { page, claims: out, removedBlocks, emptyFields, changed }
}

function issuesAt(block: Block, parts: PathPart[]): boolean {
  const parsed = blockSchema.safeParse(block)
  if (parsed.success) return false
  const target = formatPath(parts)
  return parsed.error.issues.some((i) => formatPath(i.path as PathPart[]) === target)
}

/** Remove the sentences of `text` that overlap the claim text. */
export function removeSentences(text: string, claimText: string): string {
  const spans = sentenceSpans(text)
  const same = (t: string) =>
    t.toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
  const needle = same(claimText.trim()).replace(/[.!?]+$/, '')
  const at = needle ? same(text).indexOf(needle) : -1
  const drop =
    at !== -1
      ? spans.filter((s) => s.start < at + needle.length && s.end > at)
      : spans.filter((s) => looseIncludes(s.text, claimText) || looseIncludes(claimText, s.text))
  if (!drop.length) return text
  const keep = spans.filter((s) => !drop.includes(s))
  return keep
    .map((s) => s.text)
    .join(' ')
    .trim()
}
