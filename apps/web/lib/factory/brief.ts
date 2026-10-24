import { z } from 'zod'
import { siteTypeSchema } from '@pageforge/blocks'
import type { Brief } from './engine'

export { audienceSuggestions, exampleBriefs, goalLabels, siteTypeLabels } from './brief-data'

/** Brief as typed into the Factory form. Mirrors `Brief` from @pageforge/agents. */
export const briefSchema = z.object({
  prospect: z
    .string()
    .trim()
    .min(3, 'Name the prospect in a few words.')
    .max(120, 'Keep the prospect under 120 characters.'),
  siteType: siteTypeSchema,
  audience: z
    .array(z.string().trim().min(2, 'Audience roles need at least 2 characters.').max(40))
    .min(1, 'Add at least one audience role.')
    .max(4, 'Pick up to four audience roles.')
    .refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, {
      message: 'Each audience role should appear once.',
    }),
  goal: z.enum(['book-demo', 'download-report', 'contact-sales']),
  notes: z.string().trim().max(600, 'Keep notes under 600 characters.').optional(),
}) satisfies z.ZodType<Brief>

export const createRunSchema = briefSchema.extend({
  turnstileToken: z.string().max(4096).optional(),
  /** Admin only. Ignored (forced to demo) for everyone else. */
  mode: z.enum(['demo', 'production']).optional(),
})

export type CreateRunInput = z.infer<typeof createRunSchema>

export function parseBrief(input: unknown) {
  const result = createRunSchema.safeParse(input)
  if (result.success) {
    const { turnstileToken, mode, ...brief } = result.data
    if (brief.notes === '') delete brief.notes
    return { ok: true as const, brief: brief as Brief, turnstileToken, mode }
  }
  const fieldErrors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    fieldErrors[key] ??= issue.message
  }
  return { ok: false as const, fieldErrors }
}
