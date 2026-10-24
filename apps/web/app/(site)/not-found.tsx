import Link from 'next/link'
import { mainNav, navCta } from '@/lib/site'

export default function NotFound() {
  const links = [{ label: 'Home', href: '/' }, ...mainNav, navCta]
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h1 className="text-4xl">Page not found</h1>
      <p className="mt-6 max-w-measure text-lg text-fg-muted">
        This address does not match a page. It may have been renamed, or a campaign page may have
        been retired. These pages are a good place to pick up:
      </p>
      <ul className="mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.href} className="border-l-2 border-contour pl-4">
            <Link href={l.href} className="font-semibold hover:text-accent">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
