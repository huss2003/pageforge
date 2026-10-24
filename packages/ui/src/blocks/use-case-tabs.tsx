import type { BlockProps } from '@pageforge/blocks'
import { SitePlan } from '../illustrations/site-plans'
import { BlockSection, FindingMark, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

/**
 * One tab per kind of site. Built on the same radio switch as the route
 * planner, so it renders on the server and works without JavaScript; the
 * browser's radio group gives arrow-key movement between tabs.
 *
 * Each panel pairs the site's story with a detail crop of its plan and the
 * findings a flight there typically returns, listed like a flight log.
 */
export function UseCaseTabs(props: BlockProps<'useCaseTabs'> & BlockExtras) {
  const { _key, heading, tabs } = props
  const name = `${_key}-tab`
  return (
    <BlockSection block={props} field="shade">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeading id={headingId(_key)} text={heading} column="wide" />
      </div>

      <div className="hl-switch mt-10 md:mt-14">
        {tabs.map((t, i) => (
          <input
            key={t.label}
            type="radio"
            name={name}
            id={`${name}-${i}`}
            defaultChecked={i === 0}
            aria-label={t.label}
          />
        ))}
        <div className="hl-segmented hl-switch-options" role="presentation">
          {tabs.map((t, i) => (
            <label key={t.label} htmlFor={`${name}-${i}`} data-option={String(i)}>
              {t.label}
            </label>
          ))}
        </div>

        <div className="mt-8">
          {tabs.map((t, i) => (
            <div
              key={t.label}
              data-panel={String(i)}
              className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
            >
              <div className="flex flex-col">
                <h3 className="max-w-[22ch] text-title font-semibold text-fg [font-stretch:112%]">
                  {t.heading}
                </h3>
                <p className="mt-4 max-w-[48ch] text-base text-fg">{t.body}</p>
                <h4 className="mt-8 text-sm font-semibold text-fg">What a flight here finds</h4>
                <ul className="mt-3 flex flex-col">
                  {t.findings.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-3 border-t border-fg/20 py-3 text-base text-fg"
                    >
                      <FindingMark className="mt-1.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="self-start rounded-media border border-line bg-surface-raised p-2 sm:p-3">
                <SitePlan site={t.siteType} idPrefix={`${name}-${i}-plan`} detail animate={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BlockSection>
  )
}
