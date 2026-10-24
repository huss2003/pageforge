import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '../cn'

/**
 * The page frame: one pair of equal margins (16px on a phone, 40px on wide
 * screens) and a 86rem cap. Every block and the chrome sit on it.
 */
export function Container({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-(--container-page) px-(--gutter)', className)}
      {...props}
    />
  )
}

/**
 * Vertical rhythm, decided once:
 *  - `default`  the normal gap between sections (112px desktop, 80px phone)
 *  - `tight`    for bands that read as part of the section above (operators)
 *  - `hero`     the first screen
 *  - `flush`    no padding: the block draws its own edges
 *
 * `field` changes the whole ground, which is how sections are told apart
 * instead of by dividers or cards.
 */
export type SectionRhythm = 'default' | 'tight' | 'hero' | 'flush'
export type SectionField = 'paper' | 'shade' | 'ink'

const rhythmClass: Record<SectionRhythm, string> = {
  default: 'py-20 md:py-24 lg:py-28',
  tight: 'py-10 md:py-14',
  hero: 'pt-10 pb-16 md:pt-16 md:pb-24 lg:pt-20 lg:pb-28',
  flush: '',
}

const fieldClass: Record<SectionField, string> = {
  paper: '',
  shade: 'hl-field-shade',
  ink: 'hl-field-ink',
}

export interface SectionProps extends ComponentPropsWithoutRef<'section'> {
  rhythm?: SectionRhythm
  field?: SectionField
}

export function Section({
  rhythm = 'default',
  field = 'paper',
  className,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn('relative', fieldClass[field], rhythmClass[rhythm], className)}
      {...props}
    />
  )
}

type HeadingSize = 'display' | 'heading' | 'title'

const headingClass: Record<HeadingSize, string> = {
  display: 'text-display [font-stretch:125%] font-bold',
  heading: 'text-heading [font-stretch:125%] font-bold',
  title: 'text-title [font-stretch:112%] font-semibold',
}

export interface HeadingProps<T extends ElementType> {
  as?: T
  size?: HeadingSize
  className?: string
  children: ReactNode
  id?: string
}

/**
 * Headings are always ink, never accented. Size is chosen by role, not by tag:
 * the hero `h1` is `display`, section `h2`s are `heading`, item titles `title`.
 */
export function Heading<T extends ElementType = 'h2'>({
  as,
  size = 'heading',
  className,
  children,
  id,
}: HeadingProps<T>) {
  const Tag = (as ?? 'h2') as ElementType
  return (
    <Tag id={id} className={cn('text-fg', headingClass[size], className)}>
      {children}
    </Tag>
  )
}

type TextTone = 'default' | 'muted'
type TextSize = 'lead' | 'base' | 'sm' | 'xs'

export interface TextProps extends ComponentPropsWithoutRef<'p'> {
  size?: TextSize
  tone?: TextTone
}

const textSize: Record<TextSize, string> = {
  lead: 'text-lead',
  base: 'text-base',
  sm: 'text-sm',
  xs: 'text-xs',
}

/** Running text. Body copy stays in full ink; `muted` is for notes and meta. */
export function Text({ size = 'base', tone = 'default', className, ...props }: TextProps) {
  return (
    <p
      className={cn(
        'max-w-(--container-measure)',
        textSize[size],
        tone === 'muted' ? 'text-fg-muted' : 'text-fg',
        className,
      )}
      {...props}
    />
  )
}
