import type { BlockProps } from '@pageforge/blocks'
import { BlockSection } from './shared'
import type { BlockExtras } from './types'

/**
 * The one centred moment on a page: a single quotation set large on the ink
 * field, with the speaker under it. Statement size, never headline size.
 */
export function Testimonial(props: BlockProps<'testimonial'> & BlockExtras) {
  const { text, name, role, operator } = props
  return (
    <BlockSection block={props} field="ink" labelled={false} label={`Quote from ${name}`}>
      <figure className="mx-auto flex max-w-[52rem] flex-col items-center text-center">
        <blockquote>
          <p className="text-[clamp(1.375rem,1rem+1.2vw,2rem)] leading-[1.3] font-medium text-fg [font-stretch:105%]">
            “{text}”
          </p>
        </blockquote>
        <figcaption className="mt-10 text-base text-fg">
          <span className="font-semibold">{name}</span>
          <br />
          <span className="text-fg-muted">
            {role}, {operator}
          </span>
        </figcaption>
      </figure>
    </BlockSection>
  )
}
