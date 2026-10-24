import { pageSchema, registry, type Block, type BlockKind, type Page } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import { statText } from './facts'
import { GENERIC_LINK_LABELS, closingKind } from './goals'
import { escapeRegExp, norm, numbersIn, walkCopy } from './text'
import type { Brief } from './types'

export interface ValidationIssue {
  message: string
  /** `_key` of the block the problem is in; absent for page-level problems. */
  blockKey?: string
  rule: ValidationRule
}

export type ValidationRule =
  | 'schema'
  | 'kind'
  | 'placement'
  | 'max-per-page'
  | 'duplicate-key'
  | 'fact'
  | 'stat'
  | 'number'
  | 'banned-phrase'
  | 'slug'
  | 'seo'
  | 'link-label'

export interface ValidationResult {
  ok: boolean
  /** Messages phrased as instructions the writer can act on. */
  errors: string[]
  issues: ValidationIssue[]
}

export interface ValidateOptions {
  /** Slugs already used by other pages; the page slug must not collide. */
  existingSlugs?: Iterable<string>
}

export const SEO_LIMITS = { titleMin: 20, titleMax: 60, descriptionMin: 70, descriptionMax: 160 }

/** Routes owned by the app; a landing page may not take these slugs. */
export const RESERVED_SLUGS = new Set([
  'api',
  'factory',
  'studio',
  'admin',
  'preview',
  'draft',
  'contact',
  'resources',
  'case-studies',
  'platform',
  'industries',
  'robots-txt',
  'sitemap-xml',
])

/**
 * Checks a generated page against the block contract and the brand facts.
 * `brief` is optional so the fixer can re-validate without one (the closing
 * block is then accepted as either ctaBand or demoForm).
 */
export function validatePage(
  input: unknown,
  facts: BrandFacts,
  brief?: Pick<Brief, 'goal'> & Partial<Brief>,
  opts: ValidateOptions = {},
): ValidationResult {
  const issues: ValidationIssue[] = []
  const add = (rule: ValidationRule, message: string, blockKey?: string) =>
    issues.push({ rule, message, blockKey })

  const parsed = pageSchema.safeParse(input)
  if (!parsed.success) {
    const blocks = Array.isArray((input as { blocks?: unknown })?.blocks)
      ? ((input as { blocks: unknown[] }).blocks as { _key?: unknown; _type?: unknown }[])
      : []
    for (const issue of parsed.error.issues.slice(0, 25)) {
      const [head, index, ...rest] = issue.path
      if (head === 'blocks' && typeof index === 'number') {
        const b = blocks[index]
        const key = typeof b?._key === 'string' ? b._key : undefined
        const where = `Block ${key ?? `#${index + 1}`} (${String(b?._type ?? 'unknown')})`
        add('schema', `${where} ${rest.join('.') || 'block'}: ${humanZod(issue.message)}`, key)
      } else {
        add('schema', `${issue.path.join('.') || 'page'}: ${humanZod(issue.message)}`)
      }
    }
    return result(issues)
  }

  const page = parsed.data
  checkStructure(page, brief, add)
  checkFacts(page, facts, brief, add)
  checkCopy(page, facts, brief, add)
  checkPageMeta(page, add, opts)
  return result(issues)
}

function result(issues: ValidationIssue[]): ValidationResult {
  return { ok: issues.length === 0, errors: issues.map((i) => i.message), issues }
}

type Add = (rule: ValidationRule, message: string, blockKey?: string) => void

function label(b: Block): string {
  return `Block ${b._key} (${b._type})`
}

function checkStructure(page: Page, brief: ValidateBrief, add: Add) {
  const { blocks } = page
  if (page.kind !== 'landing') add('kind', `Page kind must be "landing", not "${page.kind}".`)

  const first = blocks[0]
  if (first?._type !== 'hero') {
    add('placement', 'The first block must be a hero.', first?._key)
  }
  const last = blocks[blocks.length - 1]!
  const expected: BlockKind[] = brief ? [closingKind(brief.goal)] : ['ctaBand', 'demoForm']
  if (!expected.includes(last._type)) {
    add(
      'placement',
      `The last block must be ${expected.join(' or ')}${brief ? ` for goal "${brief.goal}"` : ''}, not ${last._type}.`,
      last._key,
    )
  }
  if (blocks.some((b) => b._type === 'ctaBand') && blocks.some((b) => b._type === 'demoForm')) {
    add('placement', 'Use either ctaBand or demoForm, not both: demoForm replaces ctaBand.')
  }
  blocks.forEach((b, i) => {
    const placement = registry[b._type].placement
    if (placement === 'first' && i !== 0)
      add('placement', `${label(b)} must be the first block.`, b._key)
    if (placement === 'last' && i !== blocks.length - 1) {
      add('placement', `${label(b)} must be the last block.`, b._key)
    }
  })

  const counts = new Map<BlockKind, number>()
  for (const b of blocks) counts.set(b._type, (counts.get(b._type) ?? 0) + 1)
  for (const [kind, n] of counts) {
    const max = registry[kind].maxPerPage
    if (n > max) add('max-per-page', `Use ${kind} at most ${max} time(s); the page has ${n}.`)
  }

  const seen = new Set<string>()
  for (const b of blocks) {
    if (seen.has(b._key))
      add('duplicate-key', `Block _key "${b._key}" is used twice; keys must be unique.`, b._key)
    seen.add(b._key)
  }
}

type ValidateBrief = (Pick<Brief, 'goal'> & Partial<Brief>) | undefined

function checkFacts(page: Page, facts: BrandFacts, _brief: ValidateBrief, add: Add) {
  const operatorNames = new Map(facts.operators.map((o) => [norm(o.name), o]))
  const integrationNames = new Set(facts.integrations.map((i) => norm(i.name)))
  const complianceNames = new Set(facts.compliance.map((c) => norm(c.name)))
  const statValues = new Set(
    facts.stats.flatMap((s) => [norm(statText(s)), norm(`${s.value} ${s.unit ?? ''}`)]),
  )
  const list = (items: string[]) => items.slice(0, 12).join(', ') || 'none'

  for (const b of page.blocks) {
    switch (b._type) {
      case 'operatorStrip':
        for (const o of b.operators) {
          if (!operatorNames.has(norm(o.name))) {
            add(
              'fact',
              `${label(b)}: operator "${o.name}" is not in the brand facts. Use only: ${list(facts.operators.map((x) => x.name))}.`,
              b._key,
            )
          }
        }
        break
      case 'statsBand':
        for (const s of b.stats) {
          const v = norm(`${s.value}${s.unit ?? ''}`)
          const v2 = norm(`${s.value} ${s.unit ?? ''}`)
          const match = facts.stats.find(
            (f) => norm(statText(f)) === v || norm(`${f.value} ${f.unit ?? ''}`) === v2,
          )
          if (!match) {
            add(
              'stat',
              `${label(b)}: stat "${s.value}${s.unit ?? ''}" is not a brand-facts stat. Use only: ${list(facts.stats.map((f) => `${statText(f)} (${f.label})`))}.`,
              b._key,
            )
          } else if (!statValues.has(v) && !statValues.has(v2)) {
            add('stat', `${label(b)}: stat "${s.value}" must be copied exactly.`, b._key)
          }
        }
        break
      case 'caseStudy': {
        const cs = facts.caseStudies.find((c) => norm(c.operator) === norm(b.operator))
        if (!cs) {
          add(
            'fact',
            `${label(b)}: case study operator "${b.operator}" is not in the brand facts. Use one of: ${list(facts.caseStudies.map((c) => c.operator))}.`,
            b._key,
          )
          break
        }
        const metricValues = new Set([
          ...cs.metrics.map((m) => norm(m.value)),
          ...facts.stats.map((s) => norm(statText(s))),
        ])
        for (const m of b.metrics) {
          if (!metricValues.has(norm(m.value))) {
            add(
              'stat',
              `${label(b)}: metric "${m.value}" is not a metric of the ${cs.operator} case study. Use only: ${list(cs.metrics.map((x) => `${x.value} ${x.label}`))}.`,
              b._key,
            )
          }
        }
        if (b.quote) {
          const q = cs.quote
          const fromTestimonials = facts.testimonials.find(
            (t) => norm(t.text) === norm(b.quote!.text),
          )
          if ((!q || norm(q.text) !== norm(b.quote.text)) && !fromTestimonials) {
            add(
              'fact',
              `${label(b)}: the quote must be copied word for word from the brand facts, or removed.`,
              b._key,
            )
          }
        }
        if (b.siteType !== cs.siteType) {
          add('fact', `${label(b)}: siteType must be "${cs.siteType}" for ${cs.operator}.`, b._key)
        }
        break
      }
      case 'testimonial': {
        const t = facts.testimonials.find((x) => norm(x.text) === norm(b.text))
        if (!t) {
          add(
            'fact',
            `${label(b)}: testimonial text must be copied word for word from a brand-facts testimonial.`,
            b._key,
          )
        } else if (norm(t.name) !== norm(b.name) || norm(t.operator) !== norm(b.operator)) {
          add(
            'fact',
            `${label(b)}: testimonial must be attributed to ${t.name}, ${t.operator}.`,
            b._key,
          )
        }
        break
      }
      case 'integrations':
        for (const i of b.items) {
          if (!integrationNames.has(norm(i.name))) {
            add(
              'fact',
              `${label(b)}: integration "${i.name}" is not in the brand facts. Use only: ${list(facts.integrations.map((x) => x.name))}.`,
              b._key,
            )
          }
        }
        break
      case 'compliance':
        for (const c of b.items) {
          if (!complianceNames.has(norm(c.name))) {
            add(
              'fact',
              `${label(b)}: "${c.name}" is not a certification or approval in the brand facts. Use only: ${list(facts.compliance.map((x) => x.name))}.`,
              b._key,
            )
          }
        }
        break
      default:
        break
    }
  }
}

function checkCopy(page: Page, facts: BrandFacts, brief: ValidateBrief, add: Add) {
  const banned = facts.voice.bannedPhrases
    .filter((p) => p.trim())
    .map((p) => ({
      phrase: p, // Whole words, plus simple inflections: "leverage" also catches "leverages", "leveraged".
      re: new RegExp(
        `(^|[^\\p{L}\\p{N}])${escapeRegExp(p.trim())}(?:s|es|d|ed|ing)?(?=$|[^\\p{L}\\p{N}])`,
        'iu',
      ),
    }))

  // Every number in copy must exist somewhere in the facts (or the brief).
  const allowed = new Set<string>()
  walkAll(facts, (t) => numbersIn(t).forEach((n) => allowed.add(n)))
  if (brief) walkAll(brief, (t) => numbersIn(t).forEach((n) => allowed.add(n)))

  const scan = (value: unknown, where: string, key?: string) => {
    const bannedHits = new Set<string>()
    const numberHits = new Set<string>()
    walkCopy(value, (text, path) => {
      for (const { phrase, re } of banned)
        if (re.test(text)) bannedHits.add(`"${phrase}" in ${path}`)
      for (const n of numbersIn(text)) if (!allowed.has(n)) numberHits.add(`"${n}" in ${path}`)
    })
    for (const hit of bannedHits)
      add('banned-phrase', `${where}: remove banned phrase ${hit}.`, key)
    for (const hit of numberHits) {
      add(
        'number',
        `${where}: number ${hit} is not in the brand facts. Remove it or use a number from FACTS.`,
        key,
      )
    }
  }

  scan(
    { title: page.title, seo: { title: page.seo.title, description: page.seo.description } },
    'Page',
  )
  for (const b of page.blocks) {
    scan(b, label(b), b._key)
    for (const link of links(b)) {
      if (GENERIC_LINK_LABELS.includes(norm(link.label))) {
        add(
          'link-label',
          `${label(b)}: link label "${link.label}" does not say what happens next. Name the action, e.g. "Book a demo flight".`,
          b._key,
        )
      }
    }
  }
}

function links(b: Block): { label: string; href: string }[] {
  if (b._type === 'hero') return [b.primaryCta, ...(b.secondaryCta ? [b.secondaryCta] : [])]
  if (b._type === 'ctaBand') return [b.cta]
  return []
}

function walkAll(value: unknown, visit: (t: string) => void) {
  if (typeof value === 'string') visit(value)
  else if (Array.isArray(value)) value.forEach((v) => walkAll(v, visit))
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => walkAll(v, visit))
}

function checkPageMeta(page: Page, add: Add, opts: ValidateOptions) {
  if (RESERVED_SLUGS.has(page.slug))
    add('slug', `Slug "${page.slug}" is reserved by the site; choose another.`)
  if (page.slug.length < 3)
    add('slug', `Slug "${page.slug}" is too short; use 3+ characters naming the prospect.`)
  if (opts.existingSlugs) {
    for (const s of opts.existingSlugs) {
      if (s === page.slug) {
        add('slug', `Slug "${page.slug}" is already used by another page; choose a different one.`)
        break
      }
    }
  }
  const { title, description, noindex } = page.seo
  if (title.length < SEO_LIMITS.titleMin || title.length > SEO_LIMITS.titleMax) {
    add(
      'seo',
      `seo.title must be ${SEO_LIMITS.titleMin}–${SEO_LIMITS.titleMax} characters (is ${title.length}).`,
    )
  }
  if (
    description.length < SEO_LIMITS.descriptionMin ||
    description.length > SEO_LIMITS.descriptionMax
  ) {
    add(
      'seo',
      `seo.description must be ${SEO_LIMITS.descriptionMin}–${SEO_LIMITS.descriptionMax} characters (is ${description.length}).`,
    )
  }
  if (page.kind === 'landing' && !noindex) {
    add('seo', 'seo.noindex must be true: prospect landing pages are excluded from search.')
  }
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
