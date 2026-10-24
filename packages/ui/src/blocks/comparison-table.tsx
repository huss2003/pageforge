import type { BlockProps } from '@pageforge/blocks'
import { cn } from '../cn'
import { CheckGlyph, DashGlyph } from '../primitives/glyphs'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras } from './types'

function Cell({ value }: { value: boolean | string | undefined }) {
  if (value === true)
    return (
      <>
        <CheckGlyph className="inline-block size-4" />
        <span className="sr-only">Yes</span>
      </>
    )
  if (value === false || value === undefined)
    return (
      <>
        <DashGlyph className="inline-block size-4 text-fg-muted" />
        <span className="sr-only">No</span>
      </>
    )
  return <>{value}</>
}

/**
 * A real table: methods compared row by row. The Hoverline column is the one
 * filled column on the sheet (raised surface, ink rule on top); the rest stay
 * on paper. On a phone each row becomes a small card with the columns listed.
 */
export function ComparisonTable(props: BlockProps<'comparisonTable'> & BlockExtras) {
  const { _key, heading, intro, columns, rows } = props
  return (
    <BlockSection block={props}>
      <div className="grid gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end">
        <SectionHeading id={headingId(_key)} text={heading} column="narrow" />
        {intro ? <p className="max-w-[52ch] text-lead text-fg lg:pb-1">{intro}</p> : null}
      </div>

      {/* Desktop and tablet: the table */}
      <div className="mt-12 hidden md:block">
        <table className="w-full border-collapse text-left text-base">
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr>
              <td className="w-[34%]" />
              {columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    'px-5 pt-5 pb-4 align-bottom text-base font-semibold text-fg',
                    i === 0 &&
                      'rounded-t-media border-t-[3px] border-fg bg-surface-raised text-lead [font-stretch:112%]',
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.label} className="border-t border-line">
                <th scope="row" className="py-4 pr-6 align-top font-medium text-fg">
                  {r.label}
                </th>
                {columns.map((c, ci) => (
                  <td
                    key={c}
                    className={cn(
                      'px-5 py-4 align-top text-fg',
                      ci === 0 && 'bg-surface-raised font-semibold',
                      ci === 0 && ri === rows.length - 1 && 'rounded-b-media',
                    )}
                  >
                    <Cell value={r.values[ci]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: one block per row, Hoverline first */}
      <ul className="mt-10 flex flex-col md:hidden">
        {rows.map((r) => (
          <li key={r.label} className="border-t border-line py-5">
            <p className="text-base font-semibold text-fg">{r.label}</p>
            <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
              {columns.map((c, ci) => (
                <div key={c} className="contents">
                  <dt className={cn('text-fg-muted', ci === 0 && 'font-semibold text-fg')}>{c}</dt>
                  <dd className={cn('text-right text-fg', ci === 0 && 'font-semibold')}>
                    <Cell value={r.values[ci]} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </BlockSection>
  )
}
