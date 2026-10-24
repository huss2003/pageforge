import { BarChartIcon } from '@sanity/icons/BarChart'
import { BlockquoteIcon } from '@sanity/icons/Blockquote'
import { CheckmarkCircleIcon } from '@sanity/icons/CheckmarkCircle'
import { CodeBlockIcon } from '@sanity/icons/CodeBlock'
import { DocumentTextIcon } from '@sanity/icons/DocumentText'
import { EnvelopeIcon } from '@sanity/icons/Envelope'
import { HelpCircleIcon } from '@sanity/icons/HelpCircle'
import { LaunchIcon } from '@sanity/icons/Launch'
import { PlugIcon } from '@sanity/icons/Plug'
import { RocketIcon } from '@sanity/icons/Rocket'
import { SplitHorizontalIcon } from '@sanity/icons/SplitHorizontal'
import { StackCompactIcon } from '@sanity/icons/StackCompact'
import { ThListIcon } from '@sanity/icons/ThList'
import { UsersIcon } from '@sanity/icons/Users'
import { registry, type BlockKind } from '@pageforge/blocks'
import { defineArrayMember, defineField, defineType } from 'sanity'
import {
  arrayLimits,
  excerpt,
  linkField,
  siteTypeField,
  stringListField,
  textField,
} from './fields'

/**
 * One Sanity object type per block, mirroring packages/blocks/src/schemas.ts
 * field for field (same names, same max lengths, same array limits). The
 * content layer validates every document with zod again before rendering,
 * so Studio validation is the friendly first line and zod is the guarantee.
 *
 * Titles and descriptions come from the block registry, so editors read the
 * same "when to use this block" guidance the planner agent does.
 */

const meta = (kind: BlockKind) => ({
  name: kind,
  title: registry[kind].title,
  description: registry[kind].aiUsage,
})

const plural = (n: number | undefined, word: string) => `${n ?? 0} ${word}${n === 1 ? '' : 's'}`

export const linkType = defineType({
  name: 'link',
  title: 'Link',
  type: 'object',
  fields: [
    textField({ name: 'label', title: 'Label', max: 32 }),
    defineField({
      name: 'href',
      title: 'URL or path',
      type: 'string',
      description: 'A site path like /book-a-demo, an anchor like #demo-form, or a full URL.',
      validation: (rule) => rule.required().min(1).max(200),
    }),
  ],
  preview: { select: { title: 'label', subtitle: 'href' } },
})

export const hero = defineType({
  ...meta('hero'),
  type: 'object',
  icon: RocketIcon,
  fields: [
    defineField({
      name: 'variant',
      title: 'Layout',
      type: 'string',
      options: {
        list: [
          { title: 'Route: interactive site plan', value: 'route' },
          { title: 'Statement: type-led', value: 'statement' },
          { title: 'Split: copy and product fragment', value: 'split' },
        ],
        layout: 'radio',
      },
      initialValue: 'route',
      validation: (rule) => rule.required(),
    }),
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    textField({ name: 'subheading', title: 'Supporting line', max: 260 }),
    linkField('primaryCta', 'Primary button'),
    linkField('secondaryCta', 'Secondary link', { optional: true }),
    siteTypeField({ initial: true, title: 'Site plan shown' }),
  ],
  preview: {
    select: { title: 'heading', variant: 'variant' },
    prepare: ({ title, variant }) => ({ title, subtitle: `Hero · ${variant ?? 'route'}` }),
  },
})

export const operatorStrip = defineType({
  ...meta('operatorStrip'),
  type: 'object',
  icon: UsersIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 80, optional: true }),
    defineField({
      name: 'operators',
      title: 'Operators',
      type: 'array',
      description: 'Shown as set wordmarks. Use operators from the brand facts only.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'operator',
          fields: [
            textField({ name: 'name', title: 'Name', max: 40 }),
            textField({ name: 'sector', title: 'Sector', max: 40 }),
          ],
          preview: { select: { title: 'name', subtitle: 'sector' } },
        }),
      ],
      validation: arrayLimits(3, 8),
    }),
  ],
  preview: {
    select: { title: 'heading', operators: 'operators' },
    prepare: ({ title, operators }) => ({
      title: title ?? 'Operators',
      subtitle: `Operators · ${plural(operators?.length, 'name')}`,
    }),
  },
})

export const statsBand = defineType({
  ...meta('statsBand'),
  type: 'object',
  icon: BarChartIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 80, optional: true }),
    defineField({
      name: 'stats',
      title: 'Stats',
      type: 'array',
      description: 'Only numbers that exist in the brand facts, with their basis.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'stat',
          fields: [
            textField({ name: 'value', title: 'Value', max: 12, description: 'e.g. 71' }),
            textField({
              name: 'unit',
              title: 'Unit',
              max: 12,
              optional: true,
              description: 'e.g. %',
            }),
            textField({ name: 'label', title: 'Label', max: 90 }),
            textField({
              name: 'basis',
              title: 'Basis',
              max: 120,
              optional: true,
              description: 'Where the number comes from.',
            }),
          ],
          preview: {
            select: { value: 'value', unit: 'unit', label: 'label' },
            prepare: ({ value, unit, label }) => ({
              title: `${value ?? ''}${unit ? ` ${unit}` : ''}`,
              subtitle: label,
            }),
          },
        }),
      ],
      validation: arrayLimits(2, 4),
    }),
  ],
  preview: {
    select: { title: 'heading', stats: 'stats' },
    prepare: ({ title, stats }) => ({
      title: title ?? 'Stats band',
      subtitle: `Stats · ${plural(stats?.length, 'number')}`,
    }),
  },
})

export const featureGrid = defineType({
  ...meta('featureGrid'),
  type: 'object',
  icon: ThListIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    textField({ name: 'intro', title: 'Intro', max: 280, optional: true }),
    defineField({
      name: 'features',
      title: 'Capabilities',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'feature',
          fields: [
            textField({ name: 'title', title: 'Title', max: 60 }),
            textField({ name: 'body', title: 'Body', max: 240 }),
          ],
          preview: { select: { title: 'title', subtitle: 'body' } },
        }),
      ],
      validation: arrayLimits(2, 6),
    }),
  ],
  preview: {
    select: { title: 'heading', features: 'features' },
    prepare: ({ title, features }) => ({
      title,
      subtitle: `Capabilities · ${plural(features?.length, 'item')}`,
    }),
  },
})

export const useCaseTabs = defineType({
  ...meta('useCaseTabs'),
  type: 'object',
  icon: SplitHorizontalIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    defineField({
      name: 'tabs',
      title: 'Tabs',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'tab',
          fields: [
            textField({ name: 'label', title: 'Tab label', max: 28 }),
            siteTypeField(),
            textField({ name: 'heading', title: 'Heading', max: 90 }),
            textField({ name: 'body', title: 'Body', max: 320 }),
            stringListField({
              name: 'findings',
              title: 'Typical findings',
              description: 'What a flight over this site typically finds.',
              maxLength: 80,
              min: 2,
              max: 5,
            }),
          ],
          preview: { select: { title: 'label', subtitle: 'heading' } },
        }),
      ],
      validation: arrayLimits(2, 4),
    }),
  ],
  preview: {
    select: { title: 'heading', tabs: 'tabs' },
    prepare: ({ title, tabs }) => ({
      title,
      subtitle: `Use cases · ${plural(tabs?.length, 'tab')}`,
    }),
  },
})

export const howItWorks = defineType({
  ...meta('howItWorks'),
  type: 'object',
  icon: StackCompactIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    defineField({
      name: 'steps',
      title: 'Steps',
      type: 'array',
      description: 'In order. The design numbers them; do not add "Step 1" to titles.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'step',
          fields: [
            textField({ name: 'title', title: 'Title', max: 50 }),
            textField({ name: 'body', title: 'Body', max: 220 }),
          ],
          preview: { select: { title: 'title', subtitle: 'body' } },
        }),
      ],
      validation: arrayLimits(3, 5),
    }),
  ],
  preview: {
    select: { title: 'heading', steps: 'steps' },
    prepare: ({ title, steps }) => ({
      title,
      subtitle: `How it works · ${plural(steps?.length, 'step')}`,
    }),
  },
})

export const caseStudy = defineType({
  ...meta('caseStudy'),
  type: 'object',
  icon: DocumentTextIcon,
  groups: [
    { name: 'story', title: 'Story', default: true },
    { name: 'proof', title: 'Metrics and quote' },
  ],
  fields: [
    textField({ name: 'operator', title: 'Operator', max: 60, group: 'story' }),
    { ...siteTypeField(), group: 'story' },
    textField({ name: 'heading', title: 'Heading', max: 110, group: 'story' }),
    textField({ name: 'summary', title: 'Summary', max: 420, group: 'story', rows: 6 }),
    defineField({
      name: 'slug',
      title: 'Case study page slug',
      type: 'string',
      group: 'story',
      description: 'Links the block to its full case study page. Leave empty on that page itself.',
      validation: (rule) => rule.max(80),
    }),
    defineField({
      name: 'metrics',
      title: 'Metrics',
      type: 'array',
      group: 'proof',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'metric',
          fields: [
            textField({ name: 'value', title: 'Value', max: 12 }),
            textField({ name: 'label', title: 'Label', max: 70 }),
          ],
          preview: { select: { title: 'value', subtitle: 'label' } },
        }),
      ],
      validation: arrayLimits(2, 3),
    }),
    defineField({
      name: 'quote',
      title: 'Quote',
      type: 'object',
      group: 'proof',
      options: { collapsible: true },
      fields: [
        textField({ name: 'text', title: 'Quote', max: 280 }),
        textField({ name: 'name', title: 'Name', max: 50 }),
        textField({ name: 'role', title: 'Role', max: 70 }),
      ],
    }),
  ],
  preview: {
    select: { title: 'heading', operator: 'operator' },
    prepare: ({ title, operator }) => ({
      title: excerpt(title),
      subtitle: `Case study · ${operator ?? ''}`,
    }),
  },
})

export const testimonial = defineType({
  ...meta('testimonial'),
  type: 'object',
  icon: BlockquoteIcon,
  fields: [
    textField({ name: 'text', title: 'Quote', max: 320 }),
    textField({ name: 'name', title: 'Name', max: 50 }),
    textField({ name: 'role', title: 'Role', max: 70 }),
    textField({ name: 'operator', title: 'Operator', max: 60 }),
  ],
  preview: {
    select: { text: 'text', name: 'name', operator: 'operator' },
    prepare: ({ text, name, operator }) => ({
      title: excerpt(text),
      subtitle: `Testimonial · ${name ?? ''}, ${operator ?? ''}`,
    }),
  },
})

export const comparisonTable = defineType({
  ...meta('comparisonTable'),
  type: 'object',
  icon: CodeBlockIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    textField({ name: 'intro', title: 'Intro', max: 240, optional: true }),
    defineField({
      name: 'columns',
      title: 'Columns',
      type: 'array',
      description: 'First column is Hoverline. Compare methods, not named competitors.',
      of: [defineArrayMember({ type: 'string', validation: (rule) => rule.required().max(32) })],
      validation: arrayLimits(2, 4),
    }),
    defineField({
      name: 'rows',
      title: 'Rows',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'row',
          fields: [
            textField({ name: 'label', title: 'Row label', max: 70 }),
            defineField({
              name: 'values',
              title: 'Values',
              type: 'array',
              description: 'One per column, in column order.',
              // Primitive members keep the stored shape identical to the zod
              // contract: (boolean | string)[]. Editors pick "Text" or "Yes / no".
              of: [
                defineArrayMember({
                  type: 'string',
                  title: 'Text',
                  validation: (rule) => rule.required().max(40),
                }),
                defineArrayMember({ type: 'boolean', title: 'Yes / no' }),
              ],
              validation: (rule) =>
                rule.required().custom((values, context) => {
                  const parent = context.document as
                    { blocks?: { _key: string; columns?: unknown[] }[] } | undefined
                  const blockKey = (context.path?.[1] as { _key?: string } | undefined)?._key
                  const columns = parent?.blocks?.find((b) => b._key === blockKey)?.columns
                  if (columns && Array.isArray(values) && values.length !== columns.length) {
                    return `Add one value per column (${columns.length}).`
                  }
                  return true
                }),
            }),
          ],
          preview: { select: { title: 'label' } },
        }),
      ],
      validation: arrayLimits(3, 10),
    }),
  ],
  preview: {
    select: { title: 'heading', rows: 'rows' },
    prepare: ({ title, rows }) => ({
      title,
      subtitle: `Comparison · ${plural(rows?.length, 'row')}`,
    }),
  },
})

export const integrations = defineType({
  ...meta('integrations'),
  type: 'object',
  icon: PlugIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    textField({ name: 'intro', title: 'Intro', max: 240, optional: true }),
    defineField({
      name: 'items',
      title: 'Integrations',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'integration',
          fields: [
            textField({ name: 'name', title: 'Name', max: 40 }),
            textField({ name: 'category', title: 'Category', max: 40 }),
          ],
          preview: { select: { title: 'name', subtitle: 'category' } },
        }),
      ],
      validation: arrayLimits(3, 16),
    }),
  ],
  preview: {
    select: { title: 'heading', items: 'items' },
    prepare: ({ title, items }) => ({
      title,
      subtitle: `Integrations · ${plural(items?.length, 'item')}`,
    }),
  },
})

export const compliance = defineType({
  ...meta('compliance'),
  type: 'object',
  icon: CheckmarkCircleIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'complianceItem',
          fields: [
            textField({ name: 'name', title: 'Name', max: 40 }),
            textField({ name: 'detail', title: 'Detail', max: 160 }),
          ],
          preview: { select: { title: 'name', subtitle: 'detail' } },
        }),
      ],
      validation: arrayLimits(2, 6),
    }),
  ],
  preview: {
    select: { title: 'heading', items: 'items' },
    prepare: ({ title, items }) => ({
      title,
      subtitle: `Compliance · ${plural(items?.length, 'item')}`,
    }),
  },
})

export const faq = defineType({
  ...meta('faq'),
  type: 'object',
  icon: HelpCircleIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    defineField({
      name: 'items',
      title: 'Questions',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'faqItem',
          fields: [
            textField({ name: 'question', title: 'Question', max: 140 }),
            textField({ name: 'answer', title: 'Answer', max: 600, rows: 6 }),
          ],
          preview: { select: { title: 'question', subtitle: 'answer' } },
        }),
      ],
      validation: arrayLimits(2, 10),
    }),
  ],
  preview: {
    select: { title: 'heading', items: 'items' },
    prepare: ({ title, items }) => ({
      title,
      subtitle: `FAQ · ${plural(items?.length, 'question')}`,
    }),
  },
})

export const ctaBand = defineType({
  ...meta('ctaBand'),
  type: 'object',
  icon: LaunchIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    textField({ name: 'body', title: 'Body', max: 240, optional: true }),
    linkField('cta', 'Button'),
  ],
  preview: {
    select: { title: 'heading', label: 'cta.label' },
    prepare: ({ title, label }) => ({ title, subtitle: `Call to action · ${label ?? ''}` }),
  },
})

export const demoForm = defineType({
  ...meta('demoForm'),
  type: 'object',
  icon: EnvelopeIcon,
  fields: [
    textField({ name: 'heading', title: 'Heading', max: 90 }),
    textField({ name: 'body', title: 'Body', max: 280 }),
    textField({ name: 'submitLabel', title: 'Button label', max: 28 }),
    stringListField({
      name: 'nextSteps',
      title: 'What happens next',
      description: 'Shown next to the form.',
      maxLength: 120,
      min: 1,
      max: 4,
    }),
  ],
  preview: {
    select: { title: 'heading' },
    prepare: ({ title }) => ({ title, subtitle: 'Demo request form' }),
  },
})

/** Every block type, in registry order. */
export const blockTypes = [
  hero,
  operatorStrip,
  statsBand,
  featureGrid,
  useCaseTabs,
  howItWorks,
  caseStudy,
  testimonial,
  comparisonTable,
  integrations,
  compliance,
  faq,
  ctaBand,
  demoForm,
]
