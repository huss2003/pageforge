import Link from 'next/link'
import type { PageSummary } from '@/lib/content/summaries'

/**
 * Index layout for /industries and /case-studies. Built from page data
 * with the Hoverline tokens: left-aligned, rules and a contour accent
 * rather than cards.
 */
export function SectionIndex({
  heading,
  intro,
  items,
  variant,
}: {
  heading: string
  intro: string
  items: PageSummary[]
  variant: 'industry' | 'caseStudy'
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 lg:pt-20">
      <h1 className="max-w-[18ch] text-4xl sm:text-5xl">{heading}</h1>
      <p className="mt-6 max-w-measure text-lg text-fg-muted">{intro}</p>

      <ul className="mt-14 border-t border-line">
        {items.map((item) => (
          <li key={item.path} className="border-b border-line">
            <Link
              href={item.path}
              className="group grid gap-6 py-10 focus-visible:outline-offset-[-2px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-12"
            >
              <div className="border-l-2 border-contour pl-5 transition-colors group-hover:border-accent">
                <h2 className="text-2xl group-hover:text-accent">
                  {variant === 'caseStudy' ? item.operator : item.title}
                </h2>
                <p className="mt-3 text-fg-muted">
                  {variant === 'caseStudy' ? item.heading : item.description}
                </p>
                <span className="mt-5 inline-block font-semibold text-accent underline decoration-line underline-offset-4 group-hover:decoration-accent">
                  {variant === 'caseStudy'
                    ? 'Read the case study'
                    : `See ${item.title.toLowerCase()}`}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-5 self-start sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
                {(variant === 'caseStudy' ? item.metrics : item.routeFacts)?.map((m) => {
                  const value = 'value' in m ? m.value : ''
                  return (
                    <div key={m.label}>
                      <dt className="text-sm text-fg-muted">{m.label}</dt>
                      <dd className="mt-1 text-xl font-bold [font-stretch:125%]">{value}</dd>
                    </div>
                  )
                })}
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
