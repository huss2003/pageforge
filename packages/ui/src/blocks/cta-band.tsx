import type { BlockProps } from '@pageforge/blocks'
import { RouteStrip } from '../illustrations/route-strip'
import { ButtonLink } from '../primitives/button'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

/**
 * The closing call on the ink field: heading and action on opposite ends of
 * one line, the route landing back at the dock underneath.
 */
export function CtaBand(props: BlockProps<'ctaBand'> & BlockExtras) {
  const { _key, heading, body, cta } = props
  return (
    <BlockSection block={props} field="ink">
      <div className="grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-end">
        <div>
          <SectionHeading id={headingId(_key)} text={heading} column="wide" />
          {body ? <p className="mt-6 max-w-[52ch] text-lead text-fg">{body}</p> : null}
        </div>
        <div className="lg:justify-self-end">
          <ButtonLink href={cta.href}>{cta.label}</ButtonLink>
        </div>
      </div>
      <div className="mt-14 md:mt-20">
        <RouteStrip labels={false} />
      </div>
    </BlockSection>
  )
}
