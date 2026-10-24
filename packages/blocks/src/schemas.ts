import { z } from 'zod'

/**
 * Content schemas for every marketing block.
 *
 * These are THE contract between the three consumers of a block:
 *  - packages/ui renders `BlockProps<K>`
 *  - Sanity Studio schemas are generated from the same shapes
 *  - the writer agent must emit JSON that parses with `blockSchema`
 *
 * Rules for this file:
 *  - Every string the AI writes has a max length, so QA never has to fix
 *    a 40-word headline.
 *  - Copy fields are plain strings (no markdown) except `body`-style
 *    fields marked as "plain paragraphs separated by blank lines".
 */

const shortText = (max: number) => z.string().trim().min(1).max(max)

export const siteTypeSchema = z.enum(['refinery', 'substation', 'open-pit', 'port', 'solar-farm'])
export type SiteType = z.infer<typeof siteTypeSchema>

export const linkSchema = z.object({
  label: shortText(32),
  href: z.string().min(1).max(200),
})
export type Link = z.infer<typeof linkSchema>

/** Every block carries a stable key (Sanity `_key`) and its kind. */
const base = <K extends string, S extends z.ZodRawShape>(kind: K, shape: S) =>
  z.object({ _key: z.string().min(1).max(64), _type: z.literal(kind), ...shape })

export const heroSchema = base('hero', {
  /** route: interactive site plan; statement: type-led; split: copy + product fragment */
  variant: z.enum(['route', 'statement', 'split']),
  heading: shortText(90),
  subheading: shortText(260),
  primaryCta: linkSchema,
  secondaryCta: linkSchema.optional(),
  siteType: siteTypeSchema.default('refinery'),
})

export const operatorStripSchema = base('operatorStrip', {
  heading: shortText(80).optional(),
  /** Fictional operators rendered as set wordmarks, never as image logos. */
  operators: z
    .array(z.object({ name: shortText(40), sector: shortText(40) }))
    .min(3)
    .max(8),
})

export const statsBandSchema = base('statsBand', {
  heading: shortText(80).optional(),
  stats: z
    .array(
      z.object({
        value: shortText(12),
        unit: shortText(12).optional(),
        label: shortText(90),
        /** Where the number comes from, e.g. "Median across 2025 deployments". */
        basis: shortText(120).optional(),
      }),
    )
    .min(2)
    .max(4),
})

export const featureGridSchema = base('featureGrid', {
  heading: shortText(90),
  intro: shortText(280).optional(),
  features: z
    .array(z.object({ title: shortText(60), body: shortText(240) }))
    .min(2)
    .max(6),
})

export const useCaseTabsSchema = base('useCaseTabs', {
  heading: shortText(90),
  tabs: z
    .array(
      z.object({
        label: shortText(28),
        siteType: siteTypeSchema,
        heading: shortText(90),
        body: shortText(320),
        /** What a flight over this site typically finds. */
        findings: z.array(shortText(80)).min(2).max(5),
      }),
    )
    .min(2)
    .max(4),
})

export const howItWorksSchema = base('howItWorks', {
  heading: shortText(90),
  steps: z
    .array(z.object({ title: shortText(50), body: shortText(220) }))
    .min(3)
    .max(5),
})

export const caseStudySchema = base('caseStudy', {
  operator: shortText(60),
  siteType: siteTypeSchema,
  heading: shortText(110),
  summary: shortText(420),
  metrics: z
    .array(z.object({ value: shortText(12), label: shortText(70) }))
    .min(2)
    .max(3),
  quote: z.object({ text: shortText(280), name: shortText(50), role: shortText(70) }).optional(),
  /** Slug of a case-study page, if one exists. */
  slug: z.string().max(80).optional(),
})

export const testimonialSchema = base('testimonial', {
  text: shortText(320),
  name: shortText(50),
  role: shortText(70),
  operator: shortText(60),
})

export const comparisonTableSchema = base('comparisonTable', {
  heading: shortText(90),
  intro: shortText(240).optional(),
  /** First column is Hoverline. */
  columns: z.array(shortText(32)).min(2).max(4),
  rows: z
    .array(
      z.object({
        label: shortText(70),
        values: z.array(z.union([z.boolean(), shortText(40)])),
      }),
    )
    .min(3)
    .max(10),
})

export const integrationsSchema = base('integrations', {
  heading: shortText(90),
  intro: shortText(240).optional(),
  items: z
    .array(z.object({ name: shortText(40), category: shortText(40) }))
    .min(3)
    .max(16),
})

export const complianceSchema = base('compliance', {
  heading: shortText(90),
  items: z
    .array(z.object({ name: shortText(40), detail: shortText(160) }))
    .min(2)
    .max(6),
})

export const faqSchema = base('faq', {
  heading: shortText(90),
  items: z
    .array(z.object({ question: shortText(140), answer: shortText(600) }))
    .min(2)
    .max(10),
})

export const ctaBandSchema = base('ctaBand', {
  heading: shortText(90),
  body: shortText(240).optional(),
  cta: linkSchema,
})

export const demoFormSchema = base('demoForm', {
  heading: shortText(90),
  body: shortText(280),
  submitLabel: shortText(28),
  /** Shown next to the form: what happens after they submit. */
  nextSteps: z.array(shortText(120)).min(1).max(4),
})

export const blockSchema = z.discriminatedUnion('_type', [
  heroSchema,
  operatorStripSchema,
  statsBandSchema,
  featureGridSchema,
  useCaseTabsSchema,
  howItWorksSchema,
  caseStudySchema,
  testimonialSchema,
  comparisonTableSchema,
  integrationsSchema,
  complianceSchema,
  faqSchema,
  ctaBandSchema,
  demoFormSchema,
])

export type Block = z.infer<typeof blockSchema>
export type BlockKind = Block['_type']
export type BlockProps<K extends BlockKind> = Extract<Block, { _type: K }>

export const blockKinds = blockSchema.options.map(
  (o) => o.shape._type.value,
) as readonly BlockKind[]

export const seoSchema = z.object({
  title: shortText(60),
  description: shortText(160),
  /** Exclude from search (campaign landing pages for one prospect). */
  noindex: z.boolean().default(false),
})

export const pageKindSchema = z.enum([
  'home',
  'platform',
  'industry',
  'caseStudy',
  'landing',
  'page',
])

export const pageSchema = z.object({
  _id: z.string().optional(),
  kind: pageKindSchema,
  title: shortText(90),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words joined by hyphens')
    .max(80),
  seo: seoSchema,
  blocks: z.array(blockSchema).min(1).max(14),
  /** Set when an agent run produced this page. */
  generatedBy: z.object({ runId: z.string(), model: z.string() }).optional(),
})

export type Page = z.infer<typeof pageSchema>
export type PageKind = z.infer<typeof pageKindSchema>
