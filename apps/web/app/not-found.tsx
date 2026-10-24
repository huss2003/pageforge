import type { Metadata } from 'next'
import { SiteFooter, SiteHeader } from '@pageforge/ui'
import SiteNotFound from './(site)/not-found'
import { footerNav, mainNav, navCta, site } from '@/lib/site'

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } }

/** Global 404 for URLs outside any route segment; same content as the site 404. */
export default function NotFound() {
  return (
    <>
      <SiteHeader nav={mainNav} cta={navCta} />
      <main id="main">
        <SiteNotFound />
      </main>
      <SiteFooter disclosure={site.disclosure} nav={footerNav} />
    </>
  )
}
