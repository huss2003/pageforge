/**
 * CONTRACT STUB — replaced by the design-system build.
 * Site chrome shared by every public page.
 */
export interface NavItem {
  label: string
  href: string
}

export function SiteHeader({ nav, cta }: { nav: NavItem[]; cta: NavItem }) {
  return (
    <header>
      <a href="/">Hoverline</a>
      <nav>
        {nav.map((n) => (
          <a key={n.href} href={n.href}>
            {n.label}
          </a>
        ))}
        <a href={cta.href}>{cta.label}</a>
      </nav>
    </header>
  )
}

export function SiteFooter({ disclosure, nav }: { disclosure: string; nav: NavItem[] }) {
  return (
    <footer>
      <p>{disclosure}</p>
      {nav.map((n) => (
        <a key={n.href} href={n.href}>
          {n.label}
        </a>
      ))}
    </footer>
  )
}
