import { draftMode } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

/** Leaves draft mode and returns to the page the editor was on. */
export async function GET(request: NextRequest) {
  ;(await draftMode()).disable()
  const redirect = request.nextUrl.searchParams.get('redirect') ?? '/'
  // Only allow same-site paths.
  const target = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
  return NextResponse.redirect(new URL(target, request.url))
}
