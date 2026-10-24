import { ImageResponse } from 'next/og'
import type { SiteType } from '@pageforge/blocks'
import { tokens } from '@pageforge/ui'
import { loadArchivo } from '@/lib/og/font'
import { allOgPaths, resolveOg } from '@/lib/og/resolve'
import { site } from '@/lib/site'

/**
 * Open Graph images in the Hoverline style: chart paper, an expanded ink
 * headline and a magenta flight route with waypoints. One route serves
 * every page: /og/home, /og/platform, /og/industries/refineries …
 * Prerendered at build time; pages published later render on first request.
 */
export const dynamic = 'force-static'

export async function generateStaticParams() {
  return (await allOgPaths()).map((path) => ({ path }))
}

const size = { width: 1200, height: 630 }
const c = tokens.color

/** A route shape per site type, drawn in a 520 × 630 panel. */
const routes: Record<SiteType, string> = {
  refinery: 'M40 520 L120 420 L250 440 L330 300 L460 330 L480 170 L360 110',
  substation: 'M60 500 L60 330 L210 330 L210 170 L380 170 L380 380 L470 380',
  'open-pit': 'M50 460 C 120 300, 260 260, 300 330 S 420 470, 470 300 S 400 120, 300 110',
  port: 'M40 500 L40 140 L470 140 L470 500 L300 500 L300 320 L160 320',
  'solar-farm':
    'M60 480 L470 480 L470 400 L60 400 L60 320 L470 320 L470 240 L60 240 L60 160 L470 160',
}

const waypoints: Record<SiteType, [number, number][]> = {
  refinery: [
    [40, 520],
    [250, 440],
    [330, 300],
    [480, 170],
    [360, 110],
  ],
  substation: [
    [60, 500],
    [60, 330],
    [210, 170],
    [380, 170],
    [470, 380],
  ],
  'open-pit': [
    [50, 460],
    [300, 330],
    [470, 300],
    [300, 110],
  ],
  port: [
    [40, 500],
    [40, 140],
    [470, 140],
    [300, 320],
    [160, 320],
  ],
  'solar-farm': [
    [60, 480],
    [470, 400],
    [60, 320],
    [470, 240],
    [470, 160],
  ],
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const content = (await resolveOg(path)) ?? {
    section: site.name,
    headline: site.tagline,
    siteType: 'refinery' as SiteType,
  }
  const disclosure = 'Fictional company · PageForge portfolio project'
  const font = await loadArchivo(`${content.section}${content.headline}${disclosure}${site.name}`)
  const finding = waypoints[content.siteType].at(-2) ?? [0, 0]

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: c.paper,
        color: c.ink,
        fontFamily: font ? 'Archivo' : 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 700,
          padding: '64px 0 56px 72px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, color: c.inkMuted }}>{content.section}</div>
        <div
          style={{
            display: 'flex',
            fontSize: content.headline.length > 42 ? 58 : 70,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: '-0.02em',
          }}
        >
          {content.headline}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>{site.name}</div>
          <div style={{ display: 'flex', fontSize: 20, color: c.inkMuted }}>{disclosure}</div>
        </div>
      </div>
      <div
        style={{ display: 'flex', width: 500, height: '100%', borderLeft: `2px solid ${c.rule}` }}
      >
        <svg width="500" height="630" viewBox="0 0 520 630">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M-20 ${560 - i * 90} C 140 ${520 - i * 90}, 320 ${600 - i * 90}, 540 ${540 - i * 90}`}
              stroke={c.contour}
              strokeOpacity="0.35"
              strokeWidth="2"
              fill="none"
            />
          ))}
          <path
            d={routes[content.siteType]}
            stroke={c.route}
            strokeWidth="7"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {waypoints[content.siteType].map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="11"
              fill={c.paper}
              stroke={c.route}
              strokeWidth="5"
            />
          ))}
          <circle
            cx={finding[0]}
            cy={finding[1]}
            r="20"
            fill="none"
            stroke={c.signal}
            strokeWidth="5"
          />
        </svg>
      </div>
    </div>,
    {
      ...size,
      fonts: font ? [{ name: 'Archivo', data: font, weight: 800, style: 'normal' }] : undefined,
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    },
  )
}
