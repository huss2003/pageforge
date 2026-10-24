import type { BlockProps } from '@pageforge/blocks'
import { cn } from '../cn'
import { InspectionReport } from '../inspection-report'
import { RouteStrip } from '../illustrations/route-strip'
import { ButtonLink } from '../primitives/button'
import { Container } from '../primitives/layout'
import { RoutePlanner } from '../route-planner'
import { BlockSection, headingId, heroHeadingClass } from './shared'
import type { BlockExtras } from './types'

type HeroProps = BlockProps<'hero'> & BlockExtras

function Actions({ primaryCta, secondaryCta }: Pick<HeroProps, 'primaryCta' | 'secondaryCta'>) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <ButtonLink href={primaryCta.href}>{primaryCta.label}</ButtonLink>
      {secondaryCta ? (
        <ButtonLink href={secondaryCta.href} variant="quiet">
          {secondaryCta.label}
        </ButtonLink>
      ) : null}
    </div>
  )
}

/**
 * Three first screens, all built from the subject:
 *  - route: copy on the left, the live route planner on the right
 *  - statement: type across the page over the route unrolled into a strip
 *  - split: copy beside a finding from Hoverline's own app
 */
export function Hero(props: HeroProps) {
  const { _key, variant, heading, subheading, siteType, context } = props
  const site = siteType ?? 'refinery'

  if (variant === 'statement') {
    return (
      <BlockSection block={props} rhythm="hero" bare>
        <Container>
          <h1
            id={headingId(_key)}
            className={cn(
              'max-w-[20ch] font-bold text-fg [font-stretch:125%]',
              heroHeadingClass(heading, 'wide'),
            )}
          >
            {heading}
          </h1>
          <div className="mt-8 grid gap-8 md:mt-12 md:grid-cols-12 md:gap-6">
            <p className="max-w-[44ch] text-lead text-fg md:col-span-6 md:col-start-6 lg:col-span-5 lg:col-start-6">
              {subheading}
            </p>
            <div className="md:col-span-6 md:col-start-6 lg:col-span-4 lg:col-start-11 lg:self-end lg:justify-self-end">
              <Actions primaryCta={props.primaryCta} secondaryCta={props.secondaryCta} />
            </div>
          </div>
        </Container>
        <div className="mt-14 md:mt-20">
          <Container>
            <RouteStrip site={site} animate />
          </Container>
        </div>
      </BlockSection>
    )
  }

  if (variant === 'split') {
    return (
      <BlockSection block={props} rhythm="hero">
        <div className="grid items-center gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div>
            <h1
              id={headingId(_key)}
              className={cn(
                'font-bold text-fg [font-stretch:125%]',
                heroHeadingClass(heading, 'half'),
              )}
            >
              {heading}
            </h1>
            <p className="mt-6 max-w-[42ch] text-lead text-fg md:mt-8">{subheading}</p>
            <div className="mt-8 md:mt-10">
              <Actions primaryCta={props.primaryCta} secondaryCta={props.secondaryCta} />
            </div>
          </div>
          <InspectionReport site={site} />
        </div>
      </BlockSection>
    )
  }

  // route: the headline spans the sheet; the copy and the live plan share the row below.
  return (
    <BlockSection block={props} rhythm="hero">
      <h1
        id={headingId(_key)}
        className={cn(
          'max-w-[24ch] font-bold text-fg [font-stretch:125%]',
          heroHeadingClass(heading, 'wide'),
        )}
      >
        {heading}
      </h1>
      <div className="mt-8 grid items-start gap-x-14 gap-y-10 md:mt-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="flex flex-col">
          <p className="max-w-[40ch] text-lead text-fg">{subheading}</p>
          <div className="mt-8 md:mt-10">
            <Actions primaryCta={props.primaryCta} secondaryCta={props.secondaryCta} />
          </div>
        </div>
        <RoutePlanner
          id={`${_key}-planner`}
          defaultSite={site}
          routeFacts={context?.routeFacts}
          findings={context?.findings}
        />
      </div>
    </BlockSection>
  )
}
