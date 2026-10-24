import type { BlockProps } from '@pageforge/blocks'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

/**
 * Certifications and safety controls set like the stamps on an approved
 * drawing: each name inside a ruled stamp frame, the detail beside it. The
 * frame is the stamp, not a card: square, ink outline, no fill, no shadow.
 */
export function Compliance(props: BlockProps<'compliance'> & BlockExtras) {
  const { _key, heading, items } = props
  return (
    <BlockSection block={props}>
      <SectionHeading id={headingId(_key)} text={heading} column="wide" className="max-w-[24ch]" />
      <ul className="mt-12 grid gap-x-12 gap-y-8 md:mt-16 md:grid-cols-2">
        {items.map((it) => (
          <li
            key={it.name}
            className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-start gap-x-5 gap-y-2 max-sm:grid-cols-1"
          >
            <span className="inline-flex min-h-12 items-center justify-self-start border-[1.5px] border-fg px-3 py-2 text-base leading-tight font-bold whitespace-nowrap text-fg [font-stretch:125%] max-sm:whitespace-normal">
              {it.name}
            </span>
            <p className="max-w-[44ch] pt-2 text-base text-fg max-sm:pt-0">{it.detail}</p>
          </li>
        ))}
      </ul>
    </BlockSection>
  )
}
