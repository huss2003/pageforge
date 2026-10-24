import { z } from 'zod'
import type { AccountBrief, CtaConfig, TrackEvent } from './types'

/** Request schemas for the ABM API. Messages are written for the marketer. */

const text = (max: number, label: string) =>
  z.string().trim().max(max, `Keep ${label} under ${max} characters.`)

export const industrySchema = z.enum(
  ['ports', 'refineries', 'power-grids', 'open-pit-mining', 'solar'],
  {
    error: 'Choose an industry.',
  },
)
export const campaignTypeSchema = z.enum(['demo', 'campaign', 'solutions'])
export const sourceChannelSchema = z.enum([
  'email',
  'linkedin',
  'sales-sequence',
  'event',
  'paid',
  'other',
])

export const accountBriefSchema = z.object({
  companyName: text(80, 'the company name').min(2, 'Enter the company name.'),
  companyUrl: text(300, 'the URL')
    .min(1, 'Enter the company website.')
    .refine((u) => {
      try {
        const p = new URL(u).protocol
        return p === 'http:' || p === 'https:'
      } catch {
        return false
      }
    }, 'Enter a full http(s) URL, like https://example.com.'),
  industry: industrySchema,
  siteCount: z.number().int().min(1).max(10000).optional(),
  campaignType: campaignTypeSchema,
  goal: z.enum(['book-meeting', 'download-report', 'event-invite']),
  painPoints: z
    .array(text(120, 'each pain point').min(1))
    .max(6, 'Use at most 6 pain points.')
    .default([]),
  targetRole: text(60, 'the target role').min(1, 'Enter the target role.'),
  sourceChannel: sourceChannelSchema,
  salesNotes: text(600, 'sales notes').optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
}) satisfies z.ZodType<AccountBrief, unknown>

export const sessionBodySchema = z.object({
  role: z.enum(['marketer', 'sales', 'reviewer', 'admin']),
  workspace: z.enum(['demo', 'main']).default('demo'),
  password: z.string().max(200).optional(),
})

export const sourcesBodySchema = z.object({
  urls: z.array(z.string().trim().max(300)).max(4).optional(),
})

export const factsPatchSchema = z
  .array(z.object({ factId: z.string().min(1).max(64), included: z.boolean() }))
  .min(1)
  .max(100)

export const ctaSchema = z.object({
  label: text(32, 'the CTA label').min(1),
  kind: z.enum(['calendar', 'form']),
  formFields: z
    .array(z.enum(['role', 'phone', 'message', 'siteCount']))
    .max(4)
    .default([]),
}) satisfies z.ZodType<CtaConfig, unknown>

export const versionPatchSchema = z.union([
  z
    .array(
      z.object({
        blockKey: z.string().min(1).max(64),
        field: z.string().min(1).max(120),
        value: z.union([z.string().max(2000), z.boolean()]),
      }),
    )
    .min(1)
    .max(50),
  z.object({ cta: ctaSchema }),
  z.object({
    seo: z.object({
      title: text(60, 'the SEO title').min(1).optional(),
      description: text(160, 'the SEO description').min(1).optional(),
      noindex: z.boolean().optional(),
    }),
  }),
])

export const claimPatchSchema = z.object({
  status: z.enum(['supported', 'rejected', 'needs_review']),
  note: text(500, 'the note').optional(),
})

export const approveSchema = z.object({ note: text(500, 'the note').optional() })
export const requestChangesSchema = z.object({
  note: text(500, 'the note').min(1, 'Say what needs to change.'),
})
export const versionRefSchema = z.object({ versionId: z.string().min(1).max(64) })
export const publishSchema = versionRefSchema.extend({
  /** ISO date; null = no expiry; omitted = keep the current or default expiry. */
  expiresAt: z.string().max(40).nullable().optional(),
})
export const duplicateSchema = z.object({ brief: accountBriefSchema })

const utmValue = z.string().trim().max(120)
const utmSchema = z
  .object({
    source: utmValue,
    medium: utmValue,
    campaign: utmValue,
    content: utmValue,
    term: utmValue,
  })
  .partial()

/**
 * Props the engagement timeline reads, per event type. Other keys are
 * allowed but bounded (≤ 12 keys, strings ≤ 200 chars).
 */
const PROP_TYPES: Record<string, Record<string, z.ZodType>> = {
  page_view: { referrer: z.string().max(200) },
  scroll_depth: { depth: z.number().int().min(0).max(100) },
  cta_click: {
    label: z.string().max(120),
    from: z.string().max(60),
    action: z.string().max(20),
    slot: z.string().max(40),
  },
  form_start: { form: z.enum(['lead', 'meeting']) },
  form_submit: { form: z.enum(['lead', 'meeting']) },
  meeting_booked: { slot: z.string().max(40), timezone: z.string().max(64) },
}

export const trackEventSchema = z
  .object({
    campaignId: z.string().max(64).nullable(),
    versionId: z.string().max(64).nullable(),
    pageKind: z.enum(['account', 'generic']),
    path: z.string().max(300),
    visitorId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/),
    type: z.enum([
      'page_view',
      'scroll_depth',
      'cta_click',
      'form_start',
      'form_submit',
      'meeting_booked',
    ]),
    props: z
      .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()]))
      .refine((p) => Object.keys(p).length <= 12, 'Too many props.')
      .optional(),
    utm: utmSchema.optional(),
  })
  .superRefine((e, ctx) => {
    const known = PROP_TYPES[e.type] ?? {}
    for (const [key, value] of Object.entries(e.props ?? {})) {
      const schema = known[key]
      if (schema && !schema.safeParse(value).success)
        ctx.addIssue({
          code: 'custom',
          path: ['props', key],
          message: `Invalid ${key} for ${e.type}.`,
        })
    }
  }) satisfies z.ZodType<TrackEvent, unknown>

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'That email address is too long.')
  .pipe(z.email('Enter a work email address, like jo@company.com.'))

export const leadBodySchema = z.object({
  campaignId: z.string().max(64).nullable(),
  versionId: z.string().max(64).nullable().optional(),
  visitorId: z.string().max(64).nullable().optional(),
  fields: z.object({
    name: text(100, 'your name').min(1, 'Enter your name.'),
    email,
    company: text(120, 'the company name').min(1, 'Enter your company.'),
    role: text(100, 'your role').optional(),
    phone: text(40, 'the phone number').optional(),
    message: text(1000, 'the message').optional(),
    siteCount: z.union([z.number().int().min(1).max(10000), text(10, 'the site count')]).optional(),
  }),
  utm: utmSchema.optional(),
  pageUrl: z.string().max(500).optional(),
  turnstileToken: z.string().max(4096).nullish(),
})

export const meetingBodySchema = z.object({
  campaignId: z.string().max(64).nullable(),
  leadId: z.string().max(64).nullable().optional(),
  visitorId: z.string().max(64).nullable().optional(),
  slotStart: z.string().max(40),
  timezone: z.string().trim().min(1).max(64),
  name: text(100, 'your name').min(1, 'Enter your name.'),
  email,
  company: text(120, 'the company name').min(1, 'Enter your company.'),
  utm: utmSchema.optional(),
  pageUrl: z.string().max(500).optional(),
  turnstileToken: z.string().max(4096).nullish(),
})
