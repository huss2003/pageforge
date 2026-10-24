import { revalidatePath, revalidateTag } from 'next/cache'
import { parseBody } from 'next-sanity/webhook'
import { NextResponse, type NextRequest } from 'next/server'
import type { PageKind } from '@pageforge/blocks'
import { tags } from '@/lib/content'
import { pathFor } from '@/lib/paths'

/**
 * Sanity webhook → on-demand revalidation.
 *
 * Configure in sanity.io/manage → API → Webhooks:
 *   URL        https://<site>/api/revalidate
 *   Trigger    create, update, delete
 *   Filter     _type == "page"
 *   Projection {_type, kind, "slug": slug.current}
 *   Secret     same value as SANITY_REVALIDATE_SECRET
 *
 * Expires the page's tag and the `pages` listing tag, so the page,
 * its section index, the sitemap and llms.txt refresh within seconds.
 */
interface WebhookPayload {
  _type?: string
  kind?: PageKind
  slug?: string
}

export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'SANITY_REVALIDATE_SECRET is not set.' }, { status: 501 })
  }

  try {
    const { isValidSignature, body } = await parseBody<WebhookPayload>(request, secret, true)
    if (!isValidSignature) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
    }
    if (!body?._type) {
      return NextResponse.json({ error: 'Missing _type in payload.' }, { status: 400 })
    }

    const expired: string[] = [tags.pages]
    revalidateTag(tags.pages, { expire: 0 })
    if (body.slug) {
      revalidateTag(tags.page(body.slug), { expire: 0 })
      expired.push(tags.page(body.slug))
    }
    // Pages first published after the build have no cache entry yet;
    // expiring the path makes the next request render them.
    if (body.slug && body.kind) revalidatePath(pathFor(body.kind, body.slug))

    return NextResponse.json({ revalidated: expired, now: Date.now() })
  } catch (error) {
    console.error('[revalidate] webhook failed', error)
    return NextResponse.json({ error: 'Could not process webhook.' }, { status: 500 })
  }
}
