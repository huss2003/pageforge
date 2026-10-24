/**
 * Hero illustration: a survey-chart site plan of a refinery with the drone's
 * inspection route drawn over it. The route animates in once on load
 * (disabled for reduced-motion users via the global stylesheet).
 */

const waypoints: [number, number][] = [
  [60, 320],
  [120, 150],
  [300, 60],
  [480, 60],
  [500, 200],
  [420, 320],
  [300, 362],
  [120, 400],
]

const tanks: { x: number; y: number; id: number }[] = [
  { x: 170, y: 200, id: 1 },
  { x: 240, y: 200, id: 2 },
  { x: 170, y: 270, id: 3 },
  { x: 240, y: 270, id: 4 },
]

const contours = [
  'M0 120 C 80 100, 140 60, 220 70 S 380 30, 560 52',
  'M0 160 C 70 150, 150 110, 260 118 S 420 88, 560 104',
  'M0 420 C 120 400, 220 430, 330 410 S 470 380, 560 396',
  'M0 440 C 140 424, 250 444, 360 432 S 480 414, 560 424',
  'M520 140 C 540 190, 548 260, 530 330',
]

export function SitePlan() {
  const routeD = 'M60 390 ' + waypoints.map(([x, y]) => `L${x} ${y}`).join(' ') + ' L60 390'

  return (
    <svg
      viewBox="0 0 560 450"
      role="img"
      aria-labelledby="site-plan-title site-plan-desc"
      className="h-auto w-full"
    >
      <title id="site-plan-title">Inspection route over a refinery site plan</title>
      <desc id="site-plan-desc">
        A drone leaves its dock, circles the tank farm and process units on a scheduled route, and
        flags a hot spot on tank 4.
      </desc>

      {/* Survey frame with edge ticks */}
      <rect x="0.5" y="0.5" width="559" height="449" className="fill-none stroke-line" />
      {Array.from({ length: 13 }, (_, i) => (
        <line
          key={`t${i}`}
          x1={20 + i * 40}
          x2={20 + i * 40}
          y1="0"
          y2="8"
          className="stroke-line"
        />
      ))}

      {/* Terrain contours */}
      <g className="fill-none stroke-contour" strokeWidth="1" opacity="0.55">
        {contours.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* Structures */}
      <g className="fill-surface-raised stroke-fg" strokeWidth="1.25">
        {tanks.map((t) => (
          <circle key={t.id} cx={t.x} cy={t.y} r="28" />
        ))}
        <rect x="330" y="96" width="120" height="78" rx="2" />
        <rect x="350" y="226" width="110" height="58" rx="2" />
        <circle cx="486" cy="338" r="7" />
      </g>
      <path
        d="M268 236 H 318 V 255 H 350"
        className="fill-none stroke-fg"
        strokeWidth="1.25"
        strokeDasharray="4 3"
      />

      {/* Dock */}
      <rect x="48" y="378" width="24" height="24" className="fill-fg" rx="2" />
      <text x="48" y="422" className="fill-fg-muted text-[12px]">
        Dock
      </text>

      {/* Inspection route */}
      <path
        d={routeD}
        pathLength={1400}
        className="route-path fill-none stroke-accent"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {waypoints.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="5"
          className="route-waypoint fill-surface stroke-accent"
          strokeWidth="2"
          style={{ animationDelay: `${0.5 + i * 0.25}s` }}
        />
      ))}

      {/* Finding on tank 4 */}
      <g className="route-waypoint" style={{ animationDelay: '2.7s' }}>
        <circle cx="240" cy="270" r="13" className="fill-signal" opacity="0.25" />
        <circle cx="240" cy="270" r="5" className="fill-signal" />
        <line x1="240" y1="284" x2="240" y2="326" className="stroke-fg" strokeWidth="1" />
        <text x="240" y="342" textAnchor="middle" className="fill-fg text-[13px] font-semibold">
          Tank 4: hot spot, 71 °C
        </text>
      </g>
    </svg>
  )
}
