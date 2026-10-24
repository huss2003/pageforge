import type { Metadata } from 'next'
import { JsonLd } from '@/components/json-ld'
import { SectionIndex } from '@/components/section-index'
import { getPagesByKind } from '@/lib/content'
import { sortBySite, summarize } from '@/lib/content/summaries'
import { buildMetadata, indexJsonLd } from '@/lib/seo'

const path = '/industries'
const title = 'Industries'
const description =
  'Where Hoverline flies: refinery tank farms and flares, substation yards, and open-pit mine walls and haul roads.'

export const metadata: Metadata = buildMetadata({ path, title, description })

export default async function IndustriesIndex() {
  const items = sortBySite((await getPagesByKind('industry')).map(summarize))
  return (
    <>
      <JsonLd
        data={indexJsonLd({
          path,
          name: title,
          description,
          items: items.map((i) => ({ name: i.title, path: i.path })),
        })}
      />
      <SectionIndex
        heading="Where Hoverline flies"
        intro="The same dock and drone work at each kind of site. What changes is the route, the payload settings and the findings your team asks for. Route numbers below are typical for one dock."
        items={items}
        variant="industry"
      />
    </>
  )
}
