import { defineArrayMember, defineField } from 'sanity'

/**
 * Field helpers that mirror the zod contract in @pageforge/blocks.
 * `shortText(max)` in zod is a trimmed, non-empty string with a max length;
 * these helpers give editors the same limits with a live character count.
 */

interface TextOptions {
  name: string
  title: string
  max: number
  description?: string
  optional?: boolean
  group?: string
  rows?: number
}

/** Single-line copy field (shortText in zod). */
export function textField({ name, title, max, description, optional, group, rows }: TextOptions) {
  const common = {
    name,
    title,
    description: [description, `Up to ${max} characters.`].filter(Boolean).join(' '),
    group,
    validation: (rule: import('sanity').StringRule) => {
      let r = rule.max(max).error(`Keep this under ${max} characters.`)
      if (!optional) r = r.required().min(1)
      return r
    },
  }
  // Long copy gets a textarea; short copy stays on one line.
  return max > 120
    ? defineField({ ...common, type: 'text', rows: rows ?? Math.min(6, Math.ceil(max / 90)) })
    : defineField({ ...common, type: 'string' })
}

export const siteTypeOptions = [
  { title: 'Refinery', value: 'refinery' },
  { title: 'Substation', value: 'substation' },
  { title: 'Open-pit mine', value: 'open-pit' },
  { title: 'Port terminal', value: 'port' },
  { title: 'Solar farm', value: 'solar-farm' },
]

export function siteTypeField(
  opts: { name?: string; title?: string; initial?: boolean; optional?: boolean } = {},
) {
  return defineField({
    name: opts.name ?? 'siteType',
    title: opts.title ?? 'Site type',
    type: 'string',
    options: { list: siteTypeOptions, layout: 'radio', direction: 'horizontal' },
    ...(opts.initial ? { initialValue: 'refinery' } : {}),
    validation: (rule) => (opts.optional ? rule : rule.required()),
  })
}

/** Link object (linkSchema): label ≤ 32, href ≤ 200. */
export function linkField(
  name: string,
  title: string,
  opts: { optional?: boolean; description?: string } = {},
) {
  return defineField({
    name,
    title,
    type: 'link',
    description: opts.description,
    validation: opts.optional ? undefined : (rule) => rule.required(),
  })
}

/** Array of short strings with min/max items. */
export function stringListField(opts: {
  name: string
  title: string
  maxLength: number
  min: number
  max: number
  description?: string
}) {
  return defineField({
    name: opts.name,
    title: opts.title,
    type: 'array',
    description: opts.description,
    of: [
      defineArrayMember({
        type: 'string',
        validation: (rule) => rule.required().max(opts.maxLength),
      }),
    ],
    validation: (rule) => rule.required().min(opts.min).max(opts.max),
  })
}

export function arrayLimits(min: number, max: number) {
  return (rule: import('sanity').ArrayRule<unknown[]>) =>
    rule.required().min(min).error(`Add at least ${min}.`).max(max).error(`Use at most ${max}.`)
}

/** Truncate for previews. */
export function excerpt(text: unknown, max = 60): string | undefined {
  if (typeof text !== 'string') return undefined
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
