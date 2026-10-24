import type { ReactNode } from 'react'
import type { BlockKind } from '@pageforge/blocks'
import { cn } from '../cn'
import { Container, Section, type SectionField, type SectionRhythm } from '../primitives/layout'
import type { BlockExtras } from './types'

/** Stable id for a block's heading, used by aria-labelledby. */
export function headingId(key: string) {
  return `${key}-heading`
}

/**
 * The outer frame every block renders: a <section> with data-block (always)
 * and data-block-key (preview only), its id set to the block key so CTAs can
 * link to it (`#demo`), and labelled by its heading.
 */
export function BlockSection({
  block,
  field,
  rhythm,
  labelled = true,
  label,
  className,
  containerClassName,
  bare = false,
  children,
}: {
  block: { _key: string; _type: BlockKind } & BlockExtras
  field?: SectionField
  rhythm?: SectionRhythm
  labelled?: boolean
  /** Accessible name when the section has no heading. */
  label?: string
  className?: string
  containerClassName?: string
  /** Skip the Container: the block draws its own frame. */
  bare?: boolean
  children: ReactNode
}) {
  return (
    <Section
      id={block._key}
      data-block={block._type}
      data-block-key={block['data-block-key']}
      aria-labelledby={labelled ? headingId(block._key) : undefined}
      aria-label={labelled ? undefined : label}
      field={block.field ?? field}
      rhythm={rhythm}
      className={cn('scroll-mt-20', className)}
    >
      {bare ? children : <Container className={containerClassName}>{children}</Container>}
    </Section>
  )
}

/** Amber finding marker used in lists: the same mark as on the plans. */
export function FindingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <circle cx="6" cy="6" r="4.5" className="fill-signal stroke-fg" strokeWidth="1.25" />
    </svg>
  )
}

/**
 * The writer agent decides heading length (up to 90 characters), so headings
 * pick their size from the copy and the column they sit in, aiming for two
 * lines. Characters per line are measured from Archivo at 125% width, bold
 * (about 0.61 em per character), at the column widths of a 1440px screen.
 */
type Column = 'full' | 'wide' | 'half' | 'narrow' | 'third'

const columnPx: Record<Column, number> = {
  full: 1296,
  wide: 850,
  half: 600,
  narrow: 520,
  third: 400,
}

const sizePx = { display: 79, 'display-sm': 63, heading: 52, 'heading-sm': 41 } as const
type Size = keyof typeof sizePx

/** Literal class names so Tailwind's scanner sees every one of them. */
const sizeClass: Record<Size, string> = {
  display: 'text-display',
  'display-sm': 'text-display-sm',
  heading: 'text-heading',
  'heading-sm': 'text-heading-sm',
}

function fitsTwoLines(n: number, size: Size, column: Column) {
  const perLine = columnPx[column] / (sizePx[size] * 0.61)
  // Balanced wrapping needs some slack: aim for 90% of two full lines.
  return n <= perLine * 2 * 0.9
}

function pick(text: string, column: Column, sizes: Size[]) {
  const n = text.length
  return sizes.find((s) => fitsTwoLines(n, s, column)) ?? sizes[sizes.length - 1]!
}

/** Hero h1 size: `wide` spans the page, `half` sits beside media. */
export function heroHeadingClass(text: string, width: 'wide' | 'half') {
  const size =
    width === 'wide'
      ? pick(text, 'full', ['display', 'display-sm', 'heading'])
      : pick(text, 'narrow', ['display-sm', 'heading', 'heading-sm'])
  return sizeClass[size]
}

/** Section h2 size for the column the heading sits in. */
export function sectionHeadingClass(text: string, column: Column) {
  return sizeClass[pick(text, column, ['heading', 'heading-sm'])]
}

/** A section h2: ink, expanded, sized for its column. */
export function SectionHeading({
  id,
  text,
  column,
  className,
}: {
  id: string
  text: string
  column: Column
  className?: string
}) {
  return (
    <h2
      id={id}
      className={cn(
        'font-bold text-fg [font-stretch:125%]',
        sectionHeadingClass(text, column),
        className,
      )}
    >
      {text}
    </h2>
  )
}
