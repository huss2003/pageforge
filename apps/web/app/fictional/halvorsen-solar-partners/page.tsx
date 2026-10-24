import { halvorsen } from '@/lib/abm/fictional-data'
import { FictionalSitePage, fictionalMetadata } from '../_components/fictional-site'

export const dynamic = 'force-static'
export const metadata = fictionalMetadata(halvorsen, '')

export default function Page() {
  return <FictionalSitePage site={halvorsen} path="" />
}
