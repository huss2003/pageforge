import type { BlockProps } from '@pageforge/blocks'
import { SitePlan } from '../illustrations/site-plans'
import { siteLabels } from '../site-labels'
import { ButtonLink } from '../primitives/button'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

/**
 * A case file: the plan of the operator's site with its title-block caption
 * on one side, the account, the quote and the metrics on the other. Metrics
 * are read-outs, not cards.
 */
export function CaseStudy(props: BlockProps<'caseStudy'> & BlockExtras) {
  const { _key, operator, siteType, heading, summary, metrics, quote, slug } = props
  return (
    <BlockSection block={props}>
      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
        <div className="order-2 flex flex-col lg:order-1">
          <figure className="m-0">
            <div className="rounded-media border border-line bg-surface-raised p-2 sm:p-3">
              <SitePlan site={siteType} idPrefix={`${_key}-plan`} animate={false} />
            </div>
            <figcaption className="mt-3 text-sm text-fg-muted">
              <span className="font-semibold text-fg">{operator}</span>,{' '}
              {siteLabels[siteType].toLowerCase()}. Inspection route as flown each shift.
            </figcaption>
          </figure>
          <dl
            className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-(--cols)"
            style={{ ['--cols' as string]: `repeat(${metrics.length}, minmax(0, 1fr))` }}
          >
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col">
                <dt className="order-2 mt-2 text-sm text-fg">{m.label}</dt>
                <dd className="order-1 text-heading leading-none font-bold tracking-[-0.03em] text-fg [font-stretch:125%]">
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="order-1 flex flex-col lg:order-2">
          <SectionHeading id={headingId(_key)} text={heading} column="half" />
          <p className="mt-6 max-w-[52ch] text-lead text-fg">{summary}</p>
          {quote ? (
            <figure className="mt-10 border-l-[3px] border-fg pl-6">
              <blockquote className="max-w-[46ch] text-lead font-medium text-fg">
                <p>“{quote.text}”</p>
              </blockquote>
              <figcaption className="mt-4 text-sm text-fg">
                <span className="font-semibold">{quote.name}</span>
                <span className="text-fg-muted">, {quote.role}</span>
              </figcaption>
            </figure>
          ) : null}
          {slug ? (
            <div className="mt-10">
              <ButtonLink href={`/case-studies/${slug}`} variant="secondary" size="md">
                Read the {operator} case study
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </div>
    </BlockSection>
  )
}
