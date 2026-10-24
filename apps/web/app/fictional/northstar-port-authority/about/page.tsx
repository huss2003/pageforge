import { northstar } from '@/lib/abm/fictional-data'
import { FictionalSitePage, fictionalMetadata } from '../../_components/fictional-site'

export const dynamic = 'force-static'
export const metadata = fictionalMetadata(northstar, 'about')

export default function Page() {
  return <FictionalSitePage site={northstar} path="about" />
}
