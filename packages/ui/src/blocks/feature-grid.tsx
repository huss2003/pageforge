import type { BlockProps } from '@pageforge/blocks'
import { InspectionReport } from '../inspection-report'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

/**
 * Capabilities as a spec sheet: heading and intro on the left with a crop of
 * the product beside them; the features run as a ruled two-column list under
 * it, title left and body right, like the rows of an equipment datasheet.
 */
export function FeatureGrid(props: BlockProps<'featureGrid'> & BlockExtras) {
  const { _key, heading, intro, features, siteType } = props
  return (
    <BlockSection block={props}>
      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-center">
        <div>
          <SectionHeading id={headingId(_key)} text={heading} column="half" />
          {intro ? <p className="mt-6 max-w-[48ch] text-lead text-fg">{intro}</p> : null}
        </div>
        <InspectionReport
          site={siteType ?? 'substation'}
          compact
          className="lg:max-w-[36rem] lg:justify-self-end"
        />
      </div>

      <dl className="mt-16 grid gap-x-14 md:mt-20 md:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="grid gap-x-6 gap-y-2 border-t border-fg/25 py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
          >
            <dt className="text-base font-semibold text-fg [font-stretch:112%]">{f.title}</dt>
            <dd className="text-base text-fg">{f.body}</dd>
          </div>
        ))}
      </dl>
    </BlockSection>
  )
}
