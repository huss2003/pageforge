import type { Metadata } from 'next'
import { JsonLd } from '@/components/json-ld'
import { SectionIndex } from '@/components/section-index'
import { getPagesByKind } from '@/lib/content'
import { sortBySite, summarize } from '@/lib/content/summaries'
import { buildMetadata, indexJsonLd } from '@/lib/seo'

const path = '/case-studies'
const title = 'Case studies'
const description =
  'How refinery, utility and mining operators use scheduled drone flights to find hot spots, seal gaps and slope movement earlier.'

export const metadata: Metadata = buildMetadata({ path, title, description })

export default async function CaseStudiesIndex() {
  const items = sortBySite((await getPagesByKind('caseStudy')).map(summarize))
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
        heading="Case studies"
        intro="One operator per kind of site, with the numbers from their first year of flights. The operators and people are fictional, like Hoverline."
        items={items}
        variant="caseStudy"
      />
    </>
  )
}
