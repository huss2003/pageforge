import type { SiteType } from '@pageforge/blocks'
import { cn } from './cn'
import { SitePlan, sitePlans } from './illustrations/site-plans'
import { siteLabels } from './site-labels'

export interface RouteFact {
  label: string
  value: string
}

export interface PlannerFinding {
  /** Asset ID or location, e.g. "TK-104 shell". Shown on the plan callout. */
  asset: string
  /** What the flight found, e.g. "Hot spot, 71 °C". */
  detail: string
}

export { siteLabels }

/** Defaults used when the page does not pass brand facts. Fictional but plausible. */
export const defaultRouteFacts: Record<SiteType, RouteFact[]> = {
  refinery: [
    { label: 'Route length', value: '4.8 km' },
    { label: 'Flight time', value: '26 min' },
    { label: 'Assets covered', value: '142' },
    { label: 'Flights per day', value: '3' },
  ],
  substation: [
    { label: 'Route length', value: '3.1 km' },
    { label: 'Flight time', value: '18 min' },
    { label: 'Assets covered', value: '64' },
    { label: 'Flights per day', value: '2' },
  ],
  'open-pit': [
    { label: 'Route length', value: '9.6 km' },
    { label: 'Flight time', value: '41 min' },
    { label: 'Benches surveyed', value: '7' },
    { label: 'Flights per day', value: '1' },
  ],
  port: [
    { label: 'Perimeter patrol', value: '7.5 km' },
    { label: 'Flight time', value: '34 min' },
    { label: 'Berths checked', value: 'Every 2 h after dark' },
    { label: 'Patrols per night', value: '6' },
  ],
  'solar-farm': [
    { label: 'Area per flight', value: 'Up to 60 MW' },
    { label: 'Flight time', value: '38 min' },
    { label: 'Thermal resolution', value: 'String and cell' },
    { label: 'Cadence', value: 'Weekly thermal' },
  ],
}

export const defaultFindings: Record<SiteType, PlannerFinding[]> = {
  refinery: [
    { asset: 'TK-104 shell', detail: 'Hot spot at course 3, 71 °C, 18 °C over last week' },
    { asset: 'PR-3, bent 12', detail: 'Coating loss on the lower beam, about 0.4 m²' },
    { asset: 'C-1 column', detail: 'Insulation gap at the 22 m platform' },
  ],
  substation: [
    { asset: 'T2 HV bushing', detail: '84 °C on phase A, 31 °C above phase B' },
    { asset: 'Bay 4 clamp', detail: 'Two broken strands at the line clamp' },
    { asset: 'Bus A joint', detail: '12 °C above ambient, up from 4 °C' },
  ],
  'open-pit': [
    { asset: 'Bench 5 crest', detail: '14 mm movement in 7 days on the north wall' },
    { asset: 'Ramp R2', detail: 'Grade 9.4 %, two potholes at the switchback' },
    { asset: 'Bench 3 toe', detail: 'New water seep, 6 m wide' },
  ],
  port: [
    { asset: 'North fence, panel 41', detail: 'Panel lifted at the base, gap about 40 cm' },
    { asset: 'QC-3 hoist brake', detail: '96 °C after the night shift, 38 °C over QC-2' },
    { asset: 'Row C, bay 18', detail: 'Container door open on the second tier' },
  ],
  'solar-farm': [
    { asset: 'B-14, string 6', detail: 'String running cold: open circuit or blown fuse' },
    { asset: 'C-07 module', detail: 'Hot cell at 88 °C, bypass diode suspected' },
    { asset: 'INV-2 terminal', detail: 'DC input terminal 24 °C above its neighbours' },
  ],
}

const CORE_SITES: SiteType[] = ['refinery', 'substation', 'open-pit']

export interface RoutePlannerProps {
  /** Site shown first, and the only one rendered by crawlers that ignore CSS. */
  defaultSite?: SiteType
  /** Readout per site; pass `facts.siteTypes[site].routeFacts`. Max 4 shown. */
  routeFacts?: Partial<Record<SiteType, RouteFact[]>>
  /** Findings per site, max 3: the plan has three finding positions. */
  findings?: Partial<Record<SiteType, PlannerFinding[]>>
  /**
   * Which sites to offer, in order. Defaults to the three core sites, or to
   * `defaultSite` alone when it is not one of them (a port or solar page).
   */
  sites?: SiteType[]
  /** Draw the route when the plan appears. Off in static contexts. */
  animate?: boolean
  /** Unique per page; defaults to "planner". */
  id?: string
  className?: string
}

/**
 * The signature live element: a survey-chart site plan the visitor can switch
 * between site types. Built on native radios and CSS, so it renders on the
 * server, works without JavaScript, follows the browser's arrow-key handling
 * for radio groups, and redraws the route each time a plan is shown.
 */
export function RoutePlanner({
  defaultSite = 'refinery',
  routeFacts,
  findings,
  sites: sitesProp,
  animate = true,
  id = 'planner',
  className,
}: RoutePlannerProps) {
  const name = `${id}-site`
  const sites = sitesProp ?? (CORE_SITES.includes(defaultSite) ? CORE_SITES : [defaultSite])
  const initial = sites.includes(defaultSite) ? defaultSite : sites[0]
  return (
    <fieldset
      className={cn(
        'hl-switch m-0 min-w-0 rounded-media border border-line bg-surface-raised p-0',
        className,
      )}
    >
      <legend className="sr-only">Site type</legend>
      {sites.map((site) => (
        <input
          key={site}
          type="radio"
          name={name}
          id={`${id}-${site}`}
          value={site}
          defaultChecked={site === initial}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line px-3 py-3 sm:px-4">
        <div className="hl-segmented hl-switch-options">
          {sites.map((site, i) => (
            <label key={site} htmlFor={`${id}-${site}`} data-option={String(i)}>
              {siteLabels[site]}
            </label>
          ))}
        </div>
        <p className="flex items-center gap-4 text-xs text-fg-muted max-sm:hidden">
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 22 10" width="22" height="10" aria-hidden="true">
              <path d="M1 5 H21" className="stroke-accent" strokeWidth="2.5" />
              <circle
                cx="11"
                cy="5"
                r="3.5"
                className="fill-surface-raised stroke-accent"
                strokeWidth="2"
              />
            </svg>
            Route
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" className="fill-signal stroke-fg" strokeWidth="1.25" />
            </svg>
            Finding
          </span>
        </p>
      </div>

      <div>
        {sites.map((site, i) => {
          const facts = (routeFacts?.[site]?.length ? routeFacts[site] : defaultRouteFacts[site])!
          const found = (findings?.[site]?.length ? findings[site] : defaultFindings[site])!.slice(
            0,
            sitePlans[site].anchors.length,
          )
          return (
            <div key={site} data-panel={String(i)} className="block">
              <div className="px-2 pt-2 sm:px-4 sm:pt-4">
                <SitePlan
                  site={site}
                  idPrefix={`${id}-${site}`}
                  animate={animate}
                  callouts={found.map((f) => ({ label: f.asset }))}
                />
              </div>
              <div className="grid gap-x-8 gap-y-5 px-4 pt-4 pb-5 sm:px-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 self-start">
                  {facts.slice(0, 4).map((f) => (
                    <div key={f.label} className="flex flex-col-reverse">
                      <dt className="text-xs text-fg-muted">{f.label}</dt>
                      <dd className="text-title font-semibold [font-stretch:112%] text-fg">
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="sr-only">Findings on this flight</p>
                  <ul className="flex flex-col gap-2.5">
                    {found.map((f) => (
                      <li key={f.asset} className="flex gap-2.5 text-sm text-fg">
                        <svg
                          viewBox="0 0 12 12"
                          width="12"
                          height="12"
                          aria-hidden="true"
                          className="mt-1 shrink-0"
                        >
                          <circle
                            cx="6"
                            cy="6"
                            r="4.5"
                            className="fill-signal stroke-fg"
                            strokeWidth="1.25"
                          />
                        </svg>
                        <span>
                          <span className="font-semibold">{f.asset}</span>
                          <span className="text-fg-muted">: </span>
                          {f.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
