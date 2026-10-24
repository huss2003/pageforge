import type { ReactNode } from 'react'
import { cn } from '../cn'
import { PlusGlyph } from './glyphs'

export interface DisclosureProps {
  summary: ReactNode
  children: ReactNode
  /** Native `name` groups disclosures so only one is open at a time. */
  name?: string
  defaultOpen?: boolean
  className?: string
}

/**
 * Native `<details>`: keyboard, find-in-page and no-JS behaviour for free.
 * The plus turns into a cross when open; nothing else moves.
 */
export function Disclosure({ summary, children, name, defaultOpen, className }: DisclosureProps) {
  return (
    <details
      className={cn('hl-details group border-b border-line', className)}
      name={name}
      open={defaultOpen}
    >
      <summary className="flex min-h-14 items-start justify-between gap-6 py-4 text-lead font-semibold text-fg [font-stretch:105%] hover:text-accent">
        <span>{summary}</span>
        <PlusGlyph className="hl-details-glyph mt-1.5 size-4 shrink-0 text-fg" />
      </summary>
      <div className="pb-6 text-base text-fg">{children}</div>
    </details>
  )
}
