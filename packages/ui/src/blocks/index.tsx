import { Fragment } from 'react'
import type { Block } from '@pageforge/blocks'
import { CaseStudy } from './case-study'
import { ComparisonTable } from './comparison-table'
import { Compliance } from './compliance'
import { CtaBand } from './cta-band'
import { DemoForm } from './demo-form'
import { Faq } from './faq'
import { FeatureGrid } from './feature-grid'
import { Hero } from './hero'
import { HowItWorks } from './how-it-works'
import { Integrations } from './integrations'
import { OperatorStrip } from './operator-strip'
import { StatsBand } from './stats-band'
import { Testimonial } from './testimonial'
import type { SectionField } from '../primitives/layout'
import type { BlockContext } from './types'
import { UseCaseTabs } from './use-case-tabs'

export type { BlockContext, BlockExtras, DemoFormState } from './types'
export {
  CaseStudy,
  ComparisonTable,
  Compliance,
  CtaBand,
  DemoForm,
  Faq,
  FeatureGrid,
  Hero,
  HowItWorks,
  Integrations,
  OperatorStrip,
  StatsBand,
  Testimonial,
  UseCaseTabs,
}

/** The ground each block takes on its own. */
const naturalField: Record<Block['_type'], SectionField> = {
  hero: 'paper',
  operatorStrip: 'shade',
  statsBand: 'ink',
  featureGrid: 'paper',
  useCaseTabs: 'shade',
  howItWorks: 'paper',
  caseStudy: 'paper',
  testimonial: 'ink',
  comparisonTable: 'paper',
  integrations: 'shade',
  compliance: 'paper',
  faq: 'paper',
  ctaBand: 'ink',
  demoForm: 'shade',
}

/**
 * Sections are told apart by their ground, so two neighbours never share a
 * tinted field: the second one drops back to paper. Paper next to paper is
 * fine; the section gap separates them.
 */
export function resolveFields(blocks: Block[]): SectionField[] {
  const out: SectionField[] = []
  blocks.forEach((b, i) => {
    const want = naturalField[b._type]
    const prev = i > 0 ? out[i - 1] : undefined
    out.push(want !== 'paper' && want === prev ? 'paper' : want)
  })
  return out
}

function renderBlock(block: Block, context: BlockContext | undefined, field: SectionField) {
  const extras = { 'data-block-key': context?.preview ? block._key : undefined, field }
  switch (block._type) {
    case 'hero':
      return <Hero {...block} {...extras} context={context} />
    case 'operatorStrip':
      return <OperatorStrip {...block} {...extras} />
    case 'statsBand':
      return <StatsBand {...block} {...extras} />
    case 'featureGrid':
      return <FeatureGrid {...block} {...extras} />
    case 'useCaseTabs':
      return <UseCaseTabs {...block} {...extras} />
    case 'howItWorks':
      return <HowItWorks {...block} {...extras} />
    case 'caseStudy':
      return <CaseStudy {...block} {...extras} />
    case 'testimonial':
      return <Testimonial {...block} {...extras} />
    case 'comparisonTable':
      return <ComparisonTable {...block} {...extras} />
    case 'integrations':
      return <Integrations {...block} {...extras} />
    case 'compliance':
      return <Compliance {...block} {...extras} />
    case 'faq':
      return <Faq {...block} {...extras} />
    case 'ctaBand':
      return <CtaBand {...block} {...extras} />
    case 'demoForm':
      return (
        <DemoForm
          {...block}
          {...extras}
          context={{
            demoFormAction: context?.demoFormAction,
            turnstileSiteKey: context?.turnstileSiteKey,
          }}
        />
      )
    default: {
      // Exhaustiveness: a new block kind fails typecheck here until it has a component.
      const never: never = block
      return never
    }
  }
}

/**
 * Renders an ordered list of blocks. The site, the Factory preview and
 * Storybook all go through it, so every page shares one system.
 *
 * Each block renders its own <section data-block={type}>, with
 * data-block-key={_key} when `context.preview` is set, so QA issues map back
 * to the block that caused them.
 */
export function BlockRenderer({ blocks, context }: { blocks: Block[]; context?: BlockContext }) {
  const fields = resolveFields(blocks)
  return (
    <>
      {blocks.map((b, i) => (
        <Fragment key={b._key}>{renderBlock(b, context, fields[i] ?? 'paper')}</Fragment>
      ))}
    </>
  )
}
