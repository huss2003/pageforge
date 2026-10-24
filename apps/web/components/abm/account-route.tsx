import type { Metadata } from 'next'
import type { PublicPage } from '@/lib/abm/public'
import { AccountBar } from './account-bar'
import { AccountPageBody } from './account-page'
import { GONE_BODY, GONE_TITLE } from './gone'
import { TrackingScript } from './tracking-script'

const OG = { width: 1200, height: 630 }

/** A published page, or a seed fallback with no campaign behind it. */
export type RouteData = Omit<PublicPage, 'campaignId' | 'versionId'> & {
  campaignId: string | null
  versionId: string | null
}

/** Metadata for a published account or solutions page, from its SEO config. */
export function accountMetadata(data: RouteData, opts: { forceNoindex?: boolean } = {}): Metadata {
  const noindex = opts.forceNoindex || data.seo.noindex
  const image = { url: data.seo.ogImageUrl, ...OG, alt: data.seo.title }
  return {
    title: data.seo.title,
    description: data.seo.description,
    alternates: { canonical: data.canonicalUrl },
    robots: noindex
      ? { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
    // A private link must not leak through the Referer header to sites it links to.
    referrer: data.type === 'demo' ? 'same-origin' : undefined,
    openGraph: {
      type: 'website',
      url: data.canonicalUrl,
      title: data.seo.title,
      description: data.seo.description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.seo.title,
      description: data.seo.description,
      images: [image.url],
    },
  }
}

export const goneMetadata: Metadata = {
  title: GONE_TITLE,
  robots: { index: false, follow: false },
}

export function GonePage() {
  return (
    <div className="mx-auto max-w-[40rem] px-4 py-24 sm:px-6">
      <h1 className="text-2xl">{GONE_TITLE}.</h1>
      <p className="mt-3 text-fg-muted">{GONE_BODY}</p>
    </div>
  )
}

/** Server-rendered account page; client JS is only tracking, consent and the closing CTA. */
export function AccountRoute({ data, path }: { data: RouteData; path: string }) {
  return (
    <>
      {data.accountName && <AccountBar accountName={data.accountName} />}
      <AccountPageBody
        page={data.page}
        cta={data.cta}
        campaignId={data.campaignId}
        versionId={data.versionId}
        accountName={data.accountName}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
      />
      <TrackingScript
        campaignId={data.campaignId}
        versionId={data.versionId}
        pageKind={data.type === 'solutions' ? 'generic' : 'account'}
        path={path}
      />
    </>
  )
}
