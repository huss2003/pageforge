import type { BlockProps } from '@pageforge/blocks'
import { Disclosure } from '../primitives/disclosure'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

/**
 * Objections a safety lead or a planner will raise, answered plainly.
 * Native <details>, grouped by name so one opens at a time; answers stay in
 * the page for search and find-in-page.
 */
export function Faq(props: BlockProps<'faq'> & BlockExtras) {
  const { _key, heading, items } = props
  return (
    <BlockSection block={props}>
      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <SectionHeading
          id={headingId(_key)}
          text={heading}
          column="third"
          className="lg:sticky lg:top-8 lg:self-start"
        />
        <div className="border-t border-line">
          {items.map((it, i) => (
            <Disclosure
              key={it.question}
              summary={it.question}
              name={`${_key}-faq`}
              defaultOpen={i === 0}
            >
              <p className="max-w-[62ch]">{it.answer}</p>
            </Disclosure>
          ))}
        </div>
      </div>
    </BlockSection>
  )
}
