import type { SiteType } from '@pageforge/blocks'
import { cn } from '../cn'

/**
 * A strip map: the inspection route unrolled into one long band, the way a
 * pilot's strip chart shows a corridor. Stops are named after the assets on
 * that kind of site; the route leaves the dock at the left and (with
 * `returning`) lands back at it on the right.
 */

const stops: Record<SiteType, string[]> = {
  refinery: ['Dock', 'TK-101', 'TK-104', 'PR-3', 'Crude unit', 'Cracker', 'Flare F-1', 'Dock'],
  substation: ['Dock', 'Bay 1', 'Bay 2', 'Bay 3', 'Bay 4', 'Bay 5', 'T2', 'Dock'],
  'open-pit': ['Dock', 'West rim', 'Bench 7', 'Bench 5', 'Ramp R2', 'Bench 3', 'Crusher', 'Dock'],
  port: ['Dock', 'Gate 1', 'North fence', 'Cruise C1', 'Berth 3', 'QC-3', 'Terminal 2', 'Dock'],
  'solar-farm': ['Dock', 'Block A', 'Block B', 'INV-2', 'Block D', 'Block C', 'INV-1', 'Dock'],
}

const findingStop: Record<SiteType, number> = {
  refinery: 2,
  substation: 6,
  'open-pit': 3,
  port: 2,
  'solar-farm': 3,
}

const W = 1200
const H = 132

export interface RouteStripProps {
  site?: SiteType
  /** Draw the route on mount. Use only where this is the page's one moment. */
  animate?: boolean
  className?: string
  /** Hide stop names (used where the strip is a quiet band under type). */
  labels?: boolean
}

export function RouteStrip({
  site = 'refinery',
  animate = false,
  className,
  labels = true,
}: RouteStripProps) {
  const names = stops[site]
  const n = names.length
  const xs = names.map((_, i) => 40 + (i * (W - 80)) / (n - 1))
  const ys = names.map((_, i) => (i === 0 || i === n - 1 ? 86 : i % 2 === 0 ? 50 : 70))
  let d = `M${xs[0]} ${ys[0]}`
  for (let i = 1; i < n; i++) {
    const mx = (xs[i - 1]! + xs[i]!) / 2
    d += ` C ${mx} ${ys[i - 1]}, ${mx} ${ys[i]}, ${xs[i]} ${ys[i]}`
  }
  const f = findingStop[site]
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={cn('block h-auto w-full', animate && 'hl-animate', className)}
    >
      <g className="fill-none stroke-contour" strokeWidth="1" opacity="0.7">
        <path d={`M0 104 C 200 96, 380 118, 600 108 S 980 92, ${W} 104`} />
        <path d={`M0 22 C 240 30, 420 12, 640 20 S 1000 30, ${W} 18`} />
      </g>
      <g className="stroke-line" strokeWidth="1">
        {Array.from({ length: W / 40 + 1 }, (_, i) => i * 40).map((x) => (
          <path key={x} d={`M${x} ${H} V${H - (x % 200 === 0 ? 10 : 5)}`} />
        ))}
      </g>
      <path
        d={d}
        pathLength={1}
        className="hl-route fill-none stroke-accent"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {names.map((name, i) => {
        const x = xs[i]!
        const y = ys[i]!
        const isDock = i === 0 || i === n - 1
        return (
          <g key={`${name}-${i}`}>
            {isDock ? (
              <rect x={x - 9} y={y - 9} width="18" height="18" className="fill-fg" />
            ) : (
              <circle
                cx={x}
                cy={y}
                r="6"
                className="hl-mark fill-surface stroke-accent"
                strokeWidth="2.25"
                style={{ ['--mark-delay' as string]: `${0.25 + (i / (n - 1)) * 2.2}s` }}
              />
            )}
            {i === f ? (
              <g className="hl-mark" style={{ ['--mark-delay' as string]: '2.6s' }}>
                <circle
                  cx={x}
                  cy={y - 22}
                  r="7"
                  className="fill-signal stroke-fg"
                  strokeWidth="1.5"
                />
                <path d={`M${x} ${y - 15} V${y - 7}`} className="stroke-fg" strokeWidth="1" />
              </g>
            ) : null}
            {labels ? (
              <text
                x={x}
                y={isDock ? y + 30 : y + 26}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                dx={i === 0 ? -9 : i === n - 1 ? 9 : 0}
                className="fill-fg-muted text-[15px] max-md:hidden"
              >
                {name}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
