import type { BlockProps } from '@pageforge/blocks'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

/**
 * Integrations grouped by what they are for (maintenance, asset records,
 * mapping…), set as an index: category in the left column, systems in the
 * display cut on the right. Grouping comes from the data, order preserved.
 */
export function Integrations(props: BlockProps<'integrations'> & BlockExtras) {
  const { _key, heading, intro, items } = props
  const groups: { category: string; names: string[] }[] = []
  for (const it of items) {
    const g = groups.find((x) => x.category === it.category)
    if (g) g.names.push(it.name)
    else groups.push({ category: it.category, names: [it.name] })
  }
  return (
    <BlockSection block={props} field="shade">
      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <SectionHeading id={headingId(_key)} text={heading} column="narrow" />
          {intro ? <p className="mt-6 max-w-[44ch] text-lead text-fg">{intro}</p> : null}
        </div>
        <dl className="flex flex-col">
          {groups.map((g) => (
            <div
              key={g.category}
              className="grid gap-x-8 gap-y-2 border-t border-fg/25 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]"
            >
              <dt className="pt-1 text-sm text-fg-muted">{g.category}</dt>
              <dd>
                <ul className="flex flex-wrap gap-x-6 gap-y-1">
                  {g.names.map((n) => (
                    <li key={n} className="text-lead font-bold text-fg [font-stretch:115%]">
                      {n}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </BlockSection>
  )
}
