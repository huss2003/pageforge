import type { Metadata } from 'next'
import Link from 'next/link'
import { FICTIONAL_BANNER, fictionalPage, type FictionalSite } from '@/lib/abm/fictional-data'

/**
 * A plain static prospect website. The banner sits in an <aside> so the
 * source extractor (which drops asides, headers, navs and footers) never
 * quotes it; the page body is ordinary paragraphs and lists.
 */
export function fictionalMetadata(site: FictionalSite, path: string): Metadata {
  const page = fictionalPage(site, path)
  return {
    title: { absolute: path ? `${page.title} | ${site.name}` : site.name },
    description: page.lede,
    robots: { index: false, follow: false },
  }
}

const NAV_LABELS: Record<string, string> = {
  '': 'Home',
  about: 'About',
  facilities: 'Facilities',
  news: 'News',
  projects: 'Projects',
}

export function FictionalSitePage({ site, path }: { site: FictionalSite; path: string }) {
  const page = fictionalPage(site, path)
  const base = `/fictional/${site.slug}`
  return (
    <div
      style={{
        background: '#ffffff',
        color: '#1d2329',
        minHeight: '100dvh',
        fontFamily: 'Georgia, serif',
      }}
    >
      <aside
        role="note"
        style={{
          background: '#FFF4C2',
          color: '#3d3200',
          padding: '8px 16px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        {FICTIONAL_BANNER}. {site.name} does not exist; this site is a demo source for PageForge.
      </aside>
      <header style={{ background: site.accent, color: '#fff', padding: '16px' }}>
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href={base}
            style={{ color: '#fff', fontSize: 22, fontWeight: 700, textDecoration: 'none' }}
          >
            {site.name}
          </Link>
          <nav aria-label={`${site.short} site`}>
            <ul
              style={{
                display: 'flex',
                gap: 16,
                listStyle: 'none',
                margin: 0,
                padding: 0,
                fontFamily: 'system-ui, sans-serif',
                fontSize: 15,
              }}
            >
              {site.pages.map((p) => (
                <li key={p.path}>
                  <Link
                    href={p.path ? `${base}/${p.path}` : base}
                    aria-current={p.path === path ? 'page' : undefined}
                    style={{
                      color: '#fff',
                      textDecoration: p.path === path ? 'underline' : 'none',
                    }}
                  >
                    {NAV_LABELS[p.path] ?? p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 880, margin: '0 auto', padding: '32px 16px 48px', lineHeight: 1.6 }}>
        <p
          style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#5b6670', margin: 0 }}
        >
          {site.tagline}
        </p>
        <h1 style={{ fontSize: 34, lineHeight: 1.2, margin: '8px 0 16px' }}>{page.heading}</h1>
        <p style={{ fontSize: 19 }}>{page.lede}</p>
        {page.sections.map((s) => (
          <section key={s.heading} style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.list ? (
              <ul>
                {s.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </main>
      <footer
        style={{
          borderTop: '1px solid #d6dbe0',
          padding: 16,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          color: '#5b6670',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          {site.name} · {site.address} · {FICTIONAL_BANNER}
        </div>
      </footer>
    </div>
  )
}
