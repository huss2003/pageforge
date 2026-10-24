import { draftMode } from 'next/headers'
import { VisualEditing } from 'next-sanity/visual-editing'
import { SiteFooter, SiteHeader } from '@pageforge/ui'
import { footerNav, mainNav, navCta, site } from '@/lib/site'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled: preview } = await draftMode()
  return (
    <>
      <SiteHeader nav={mainNav} cta={navCta} />
      <main id="main">{children}</main>
      <SiteFooter disclosure={site.disclosure} nav={footerNav} />
      {/* Click-to-edit overlays for the Studio's Presentation tool; loads only in draft mode. */}
      {preview && <VisualEditing />}
    </>
  )
}
