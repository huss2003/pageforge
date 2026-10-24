import { ImageResponse } from 'next/og'
import { loadArchivo } from '@/lib/og/font'
import { getAbmRuntime } from '@/lib/abm/runtime'
import { INDUSTRY_LABEL } from '@/lib/abm/paths'

/**
 * Open Graph image for an account page, in the Hoverline style: chart
 * paper, ink headline and a magenta flight route. Only published pages
 * show their account name and headline; anything else gets a neutral card,
 * so a campaign id reveals nothing.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PAPER = '#EDF0EC'
const INK = '#14233A'
const ROUTE = '#B4246B'
const size = { width: 1200, height: 630 }

async function content(campaignId: string) {
  const fallback = {
    eyebrow: 'Hoverline',
    headline: 'Autonomous drone inspection, planned for your site',
  }
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return fallback
  const { store } = getAbmRuntime()
  const campaign = await store.getCampaign(campaignId).catch(() => null)
  if (!campaign || campaign.status !== 'published' || !campaign.publishedVersionId) return fallback
  const version = await store.getVersion(campaign.publishedVersionId)
  const hero = version?.page.blocks.find((b) => b._type === 'hero')
  const account = campaign.accountId ? await store.getAccount(campaign.accountId) : null
  return {
    eyebrow: account
      ? `For ${account.name}`
      : `Hoverline for ${INDUSTRY_LABEL[campaign.industry].audience}`,
    headline:
      hero && hero._type === 'hero' ? hero.heading : (version?.page.title ?? fallback.headline),
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params
  const c = await content(campaignId)
  const disclosure = 'Fictional company · PageForge portfolio project'
  const font = await loadArchivo(`${c.eyebrow}${c.headline}${disclosure}Hoverline`)
  const waypoints: [number, number][] = [
    [60, 470],
    [60, 170],
    [300, 170],
    [300, 330],
    [460, 330],
    [460, 120],
  ]
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: PAPER,
        color: INK,
        fontFamily: font ? 'Archivo' : 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 720,
          padding: '64px 0 56px 72px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 1 }}>{c.eyebrow}</div>
        <div
          style={{
            display: 'flex',
            fontSize: c.headline.length > 60 ? 54 : 66,
            lineHeight: 1.05,
            fontWeight: 800,
          }}
        >
          {c.headline}
        </div>
        <div style={{ display: 'flex', fontSize: 22, opacity: 0.7 }}>{disclosure}</div>
      </div>
      <div style={{ display: 'flex', position: 'relative', width: 480, height: '100%' }}>
        <svg width="480" height="630" viewBox="0 0 520 630">
          {Array.from({ length: 13 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={i * 40}
              y1={0}
              x2={i * 40}
              y2={630}
              stroke={INK}
              strokeOpacity={0.08}
            />
          ))}
          {Array.from({ length: 16 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={i * 40}
              x2={520}
              y2={i * 40}
              stroke={INK}
              strokeOpacity={0.08}
            />
          ))}
          <path
            d={`M${waypoints.map(([x, y]) => `${x} ${y}`).join(' L')}`}
            fill="none"
            stroke={ROUTE}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          {waypoints.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === waypoints.length - 2 ? 14 : 9}
              fill={i === waypoints.length - 2 ? ROUTE : PAPER}
              stroke={ROUTE}
              strokeWidth={5}
            />
          ))}
        </svg>
      </div>
    </div>,
    {
      ...size,
      fonts: font ? [{ name: 'Archivo', data: font, weight: 800, style: 'normal' }] : undefined,
      headers: { 'cache-control': 'public, max-age=300' },
    },
  )
}
