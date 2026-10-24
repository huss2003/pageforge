import { z } from 'zod'
import {
  blockKinds,
  blockSchema,
  pageKindSchema,
  pageSchema,
  seoSchema,
  siteTypeSchema,
  type BlockKind,
} from '@pageforge/blocks'
import type { Brief, PagePlan } from './types'

const kindEnum = z.enum(blockKinds as unknown as [BlockKind, ...BlockKind[]])
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Brief as submitted by the Factory form. */
export const briefSchema = z.object({
  prospect: z.string().trim().min(3).max(120),
  siteType: siteTypeSchema,
  audience: z.array(z.string().trim().min(2).max(60)).min(1).max(6),
  goal: z.enum(['book-demo', 'download-report', 'contact-sales']),
  notes: z.string().trim().max(600).optional(),
}) satisfies z.ZodType<Brief>

const planSection = z.object({
  kind: kindEnum,
  purpose: z.string().trim().min(1).max(200),
  factIds: z.array(z.string().max(64)).max(16).default([]),
})

/** Final plan contract: 5–9 sections (placement rules are checked in planner.ts). */
export const pagePlanSchema = z.object({
  title: z.string().trim().min(1).max(90),
  slug: z.string().regex(slugRegex, 'lowercase words joined by hyphens').max(80),
  angle: z.string().trim().min(1).max(120),
  sections: z.array(planSection).min(5).max(9),
}) satisfies z.ZodType<PagePlan, unknown>

/** What the model may return; the planner normalises it into `pagePlanSchema`. */
export const plannerOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().max(200),
  angle: z.string().trim().min(1).max(300),
  sections: z.array(planSection).min(1).max(14),
})

/**
 * Writer output schema narrowed to the block kinds in the plan, so the model
 * (and Gemini's constrained decoding) cannot emit an unplanned block.
 */
export function writerOutputSchema(kinds: BlockKind[]) {
  return pageSchema.extend({
    kind: pageKindSchema.default('landing'),
    seo: seoSchema,
    blocks: z.array(blockUnion(kinds)).min(1).max(14),
  })
}

/** Fixer output: replacement blocks for the given kinds. */
export function fixerOutputSchema(kinds: BlockKind[]) {
  return z.object({ blocks: z.array(blockUnion(kinds)).min(1).max(14) })
}

function blockUnion(kinds: BlockKind[]) {
  const wanted = new Set(kinds)
  const options = blockSchema.options.filter((o) => wanted.has(o.shape._type.value))
  if (options.length === 0) return blockSchema
  if (options.length === 1) return options[0]!
  return z.discriminatedUnion(
    '_type',
    options as unknown as [(typeof options)[0], ...typeof options],
  )
}
