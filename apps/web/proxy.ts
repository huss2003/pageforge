import { NextResponse, type NextRequest } from 'next/server'
import { goneHtml } from '@/components/abm/gone'
import { getAccountPage } from '@/lib/abm/public'

/**
 * Paused and expired account pages answer 410 Gone with a calm page.
 * App Router pages cannot set a 410 status themselves, so the check runs
 * here; every other request passes straight through.
 */
export async function proxy(request: NextRequest) {
  const [, kind, id] = request.nextUrl.pathname.split('/')
  if (!id || (kind !== 'demo' && kind !== 'campaign')) return NextResponse.next()
  try {
    const page =
      kind === 'demo'
        ? await getAccountPage({ type: 'demo', slugToken: decodeURIComponent(id) })
        : await getAccountPage({ type: 'campaign', slug: decodeURIComponent(id) })
    if (page && 'status' in page) {
      return new NextResponse(goneHtml(), {
        status: 410,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, nofollow',
        },
      })
    }
  } catch {
    // Let the route render; it handles the same states.
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/demo/:slugToken', '/campaign/:slug'],
}
