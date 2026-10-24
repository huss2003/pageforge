import type { Page } from '@pageforge/blocks'
import { BlockRenderer } from '@pageforge/ui/blocks'
import { submitDemoRequest } from '@/lib/actions/demo-request'
import { pageJsonLd } from '@/lib/seo'
import { JsonLd } from './json-ld'

/** Renders a page's blocks plus its structured data. Used by every page route. */
export function PageView({ page, preview = false }: { page: Page; preview?: boolean }) {
  return (
    <>
      <JsonLd data={pageJsonLd(page)} />
      <BlockRenderer
        blocks={page.blocks}
        context={{
          preview,
          demoFormAction: submitDemoRequest,
          turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
        }}
      />
    </>
  )
}
