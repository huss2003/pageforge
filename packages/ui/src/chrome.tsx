import { cn } from './cn'
import { buttonClass } from './primitives/button'
import { CloseGlyph, MenuGlyph, RouteGlyph } from './primitives/glyphs'
import { Container } from './primitives/layout'

/**
 * Site chrome shared by every public page.
 */
export interface NavItem {
  label: string
  href: string
}

export const SOURCE_URL = 'https://github.com/huss2003/pageforge'

function Wordmark({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={cn(
        'inline-flex min-h-11 items-center gap-2.5 text-fg [font-stretch:125%]',
        className,
      )}
    >
      <RouteGlyph className="h-[18px] w-[26px] text-accent" />
      <span className="text-lg font-bold tracking-[-0.02em]">Hoverline</span>
    </a>
  )
}

/**
 * Wordmark, three to five plain links, one action. On a phone the links move
 * into a sheet opened by a native <details>, so the menu works without
 * JavaScript and closes with the same control.
 */
export function SiteHeader({
  nav,
  cta,
  currentPath,
  className,
}: {
  nav: NavItem[]
  cta: NavItem
  /** Marks the matching link with aria-current. */
  currentPath?: string
  className?: string
}) {
  return (
    <header className={cn('relative z-20 bg-surface', className)}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:rounded-control focus:bg-fg focus:px-3 focus:py-2 focus:text-surface"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-6 lg:h-20">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          <ul className="flex items-center gap-1 xl:gap-2">
            {nav.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  aria-current={currentPath === n.href ? 'page' : undefined}
                  className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-fg decoration-accent decoration-2 underline-offset-[0.45em] hover:underline aria-[current=page]:underline"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <a href={cta.href} className={cn(buttonClass('primary', 'md'), 'ml-3')}>
            {cta.label}
          </a>
        </nav>

        <details className="group lg:hidden">
          <summary
            className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control px-2 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden"
            aria-label="Menu"
          >
            <span className="inline-flex items-center gap-2 group-open:hidden">
              <MenuGlyph />
              Menu
            </span>
            <span className="hidden items-center gap-2 group-open:inline-flex">
              <CloseGlyph />
              Close
            </span>
          </summary>
          <div className="absolute inset-x-0 top-full border-y border-line bg-surface">
            <Container className="pt-2 pb-6">
              <nav aria-label="Main">
                <ul className="flex flex-col">
                  {nav.map((n) => (
                    <li key={n.href} className="border-b border-line">
                      <a
                        href={n.href}
                        aria-current={currentPath === n.href ? 'page' : undefined}
                        className="flex min-h-14 items-center text-lead font-semibold text-fg [font-stretch:112%] aria-[current=page]:text-accent"
                      >
                        {n.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <a href={cta.href} className={cn(buttonClass('primary', 'lg'), 'mt-6 w-full')}>
                {cta.label}
              </a>
            </Container>
          </div>
        </details>
      </Container>
    </header>
  )
}

/**
 * The page ends on the route closing: a strip of the flight path landing back
 * at the dock, the wordmark, the disclosure in full ink, and the source link.
 */
export function SiteFooter({
  disclosure,
  nav,
  sourceUrl = SOURCE_URL,
  className,
}: {
  disclosure: string
  nav: NavItem[]
  sourceUrl?: string
  className?: string
}) {
  return (
    <footer className={cn('hl-field-ink', className)}>
      <Container className="pt-16 pb-10 md:pt-20">
        <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <div>
            <Wordmark className="-ml-0.5" />
            <p className="mt-5 max-w-[34ch] text-lead text-fg">{disclosure}</p>
          </div>
          <div className="flex flex-col gap-8 md:items-end">
            <nav aria-label="Footer">
              <ul className="grid grid-cols-2 gap-x-10 gap-y-1 sm:flex sm:flex-wrap sm:gap-x-8 md:justify-end">
                {nav.map((n) => (
                  <li key={n.href}>
                    <a
                      href={n.href}
                      className="inline-flex min-h-11 items-center text-base text-fg underline decoration-transparent underline-offset-[0.3em] hover:decoration-accent"
                    >
                      {n.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <a
              href={sourceUrl}
              className="inline-flex min-h-11 items-center text-base text-fg underline decoration-line underline-offset-[0.3em] hover:decoration-accent"
            >
              Built with PageForge, source on GitHub
            </a>
          </div>
        </div>
        <div aria-hidden="true" className="relative mt-14 h-10">
          <svg
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
            className="absolute inset-x-1.5 top-0 block h-10 w-[calc(100%-12px)]"
          >
            <path
              d="M0 20 C 200 4, 420 36, 620 18 S 980 6, 1200 20"
              className="fill-none stroke-accent"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span className="absolute top-[14px] left-0 size-3 bg-fg" />
          <span className="absolute top-[14px] right-0 size-3 bg-fg" />
        </div>
      </Container>
    </footer>
  )
}
