import Link from 'next/link'
import { isSanityConfigured } from '@/sanity/env'
import { Studio } from './studio'

export const dynamic = 'force-static'

export { metadata, viewport } from 'next-sanity/studio'

export default function StudioPage() {
  if (!isSanityConfigured) return <StudioSetup />
  return <Studio />
}

/** Shown instead of the Studio when the site runs on built-in content. */
function StudioSetup() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl">Studio is not connected</h1>
      <p className="mt-6 text-fg-muted">
        The site is serving its built-in Hoverline content. To edit pages here, connect a Sanity
        project:
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5">
        <li>
          Create a free project at{' '}
          <a className="underline underline-offset-4" href="https://www.sanity.io/manage">
            sanity.io/manage
          </a>{' '}
          and add <code>http://localhost:3000</code> and your site URL as CORS origins with
          credentials.
        </li>
        <li>
          Set <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> and <code>NEXT_PUBLIC_SANITY_DATASET</code>{' '}
          in <code>apps/web/.env.local</code> (or in Vercel).
        </li>
        <li>
          Load the seed pages with <code>pnpm seed:sanity</code> (needs{' '}
          <code>SANITY_API_WRITE_TOKEN</code>), then rebuild.
        </li>
      </ol>
      <p className="mt-8">
        <Link className="underline underline-offset-4" href="/">
          Back to the site
        </Link>
      </p>
    </main>
  )
}
