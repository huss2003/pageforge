import type { BlockProps } from '@pageforge/blocks'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

/**
 * A true sequence, so it is numbered: the steps sit as waypoints on one
 * route. On wide screens the route runs across the top; on a phone it runs
 * down the left edge. The final step lands on the dock square.
 */
export function HowItWorks(props: BlockProps<'howItWorks'> & BlockExtras) {
  const { _key, heading, steps } = props
  const n = steps.length
  return (
    <BlockSection block={props}>
      <SectionHeading id={headingId(_key)} text={heading} column="wide" className="max-w-[24ch]" />

      <ol
        className="mt-14 grid gap-y-0 md:mt-20 md:grid-cols-(--cols) md:gap-x-0"
        style={{ ['--cols' as string]: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {steps.map((s, i) => {
          const last = i === n - 1
          return (
            <li
              key={s.title}
              className="relative grid grid-cols-[22px_1fr] gap-x-5 pb-10 md:block md:pr-8 md:pb-0"
            >
              {/* Route segment to the next waypoint */}
              {last ? null : (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute top-[11px] bottom-0 left-[9.5px] w-[3px] bg-accent md:hidden"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute top-[9.5px] right-0 left-[11px] hidden h-[3px] bg-accent md:block"
                  />
                </>
              )}
              <span aria-hidden="true" className="relative z-10 block size-[22px]">
                {last ? (
                  <span className="absolute inset-0.5 block bg-fg" />
                ) : (
                  <span className="absolute inset-0 block rounded-full border-[3px] border-accent bg-surface" />
                )}
              </span>
              <div className="md:mt-8">
                <p className="text-sm font-semibold text-fg-muted">{i + 1}</p>
                <h3 className="mt-1 text-title font-semibold text-fg [font-stretch:112%]">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-[36ch] text-base text-fg">{s.body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </BlockSection>
  )
}
