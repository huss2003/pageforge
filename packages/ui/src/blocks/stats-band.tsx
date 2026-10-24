import type { BlockProps } from '@pageforge/blocks'
import { cn } from '../cn'
import { BlockSection, headingId } from './shared'
import type { BlockExtras } from './types'

/**
 * Outcome numbers read like an instrument panel on the ink field: each figure
 * large, its label in full ink, and where the number comes from directly
 * underneath. The first figure leads at a larger size.
 */
export function StatsBand(props: BlockProps<'statsBand'> & BlockExtras) {
  const { _key, heading, stats } = props
  const cols =
    stats.length === 4 ? 'md:grid-cols-4' : stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
  return (
    <BlockSection block={props} field="ink" labelled={Boolean(heading)}>
      {heading ? (
        <h2
          id={headingId(_key)}
          className="max-w-[22ch] text-title font-semibold text-fg [font-stretch:112%]"
        >
          {heading}
        </h2>
      ) : null}
      <dl className={cn('grid gap-x-8 gap-y-12 sm:grid-cols-2', cols, heading && 'mt-12 md:mt-16')}>
        {stats.map((s, i) => (
          <div key={s.label} className="flex flex-col border-t-2 border-fg pt-5">
            <dt className="order-2 mt-3 max-w-[30ch] text-base text-fg">{s.label}</dt>
            <dd className="order-1 flex items-baseline gap-2 text-fg">
              <span
                className={cn(
                  'font-bold tracking-[-0.03em] [font-stretch:125%]',
                  i === 0 ? 'text-display leading-none' : 'text-heading leading-none',
                )}
              >
                {s.value}
              </span>
              {s.unit ? <span className="text-lead font-semibold text-fg">{s.unit}</span> : null}
            </dd>
            {s.basis ? (
              <dd className="order-3 mt-2 max-w-[34ch] text-sm text-fg-muted">{s.basis}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </BlockSection>
  )
}
