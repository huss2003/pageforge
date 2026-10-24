import { SiteFooter, SiteHeader } from '@pageforge/ui'
import { footerNav, mainNav, site } from '@/lib/site'

/** Account and solutions pages: the site chrome, with the header action pointing at the page's own CTA. */
export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader nav={mainNav} cta={{ label: 'Book a walkthrough', href: '#book' }} />
      <main id="main">{children}</main>
      <SiteFooter disclosure={site.disclosure} nav={footerNav} />
    </>
  )
}
