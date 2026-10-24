import type { BlockProps } from '@pageforge/blocks'
import { cn } from '../cn'
import { BlockSection, headingId } from './shared'
import type { BlockExtras } from './types'

/**
 * Fictional operators set as wordmarks in the display cut, with their sector
 * underneath, the way names sit on a site-access board. No image logos.
 */
export function OperatorStrip(props: BlockProps<'operatorStrip'> & BlockExtras) {
  const { _key, heading, operators } = props
  return (
    <BlockSection
      block={props}
      rhythm="tight"
      field="shade"
      labelled={Boolean(heading)}
      label="Operators"
    >
      {heading ? (
        <h2 id={headingId(_key)} className="text-base font-semibold text-fg [font-stretch:100%]">
          {heading}
        </h2>
      ) : null}
      <ul
        className={cn(
          'grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-(--n) lg:gap-x-8',
          heading && 'mt-6',
        )}
        style={{ ['--n' as string]: `repeat(${operators.length}, minmax(0, auto))` }}
      >
        {operators.map((o) => (
          <li key={o.name} className="flex min-w-0 flex-col">
            <span
              className={cn(
                'text-base leading-tight font-bold tracking-[-0.01em] text-fg [font-stretch:125%]',
                operators.length <= 4 ? 'sm:text-lead' : 'sm:text-[1.1875rem]',
              )}
            >
              {o.name}
            </span>
            <span className="mt-1 text-xs text-fg-muted">{o.sector}</span>
          </li>
        ))}
      </ul>
    </BlockSection>
  )
}
