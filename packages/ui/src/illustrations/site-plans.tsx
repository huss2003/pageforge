import type { ReactNode } from 'react'
import type { SiteType } from '@pageforge/blocks'
import { cn } from '../cn'

/**
 * Survey-chart site plans for each kind of site Hoverline flies.
 *
 * Every plan shares one drawing language: a 640×420 sheet with edge ticks
 * and corner coordinates, sage terrain contours, structures in ink on the
 * raised surface, the dock as a filled square, the inspection route in
 * magenta with hollow waypoints, and findings as amber discs with an ink ring.
 *
 * Structure labels and callouts are set at 13 units and hidden below the
 * `sm` breakpoint, where the sheet is too small for them to be read; the
 * readout beside the plan carries the same information as text.
 */

export const PLAN_WIDTH = 640
export const PLAN_HEIGHT = 420

export type Point = readonly [number, number]

export interface FindingAnchor {
  /** Where the asset is on the plan. */
  at: Point
  /** Where the callout plate sits. */
  label: Point
  /** Default asset ID shown in the callout. */
  asset: string
}

export interface SitePlanSpec {
  site: SiteType
  title: string
  description: string
  coordinates: { nw: string; se: string }
  dock: Point
  /** Closed route: starts and ends at the dock. */
  route: Point[]
  /** Indices into `route` drawn as waypoints (corners where the drone turns). */
  waypoints: number[]
  anchors: FindingAnchor[]
  /** Where the north arrow and scale bar sit, clear of the route. */
  scale: Point
  /** Detail crop around the findings: x, y, width, height. */
  detail: readonly [number, number, number, number]
  drawing: () => ReactNode
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                           */
/* -------------------------------------------------------------------------- */

const r1 = (n: number) => Math.round(n * 10) / 10

function polyline(points: readonly Point[]) {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}`).join(' ')
}

function segmentLengths(points: readonly Point[]) {
  const out: number[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    out.push(Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  return out
}

/** Fraction of the route travelled when the drone reaches point `i`. */
export function routeProgress(points: readonly Point[]) {
  const lengths = segmentLengths(points)
  const total = lengths.reduce((s, l) => s + l, 0)
  let run = 0
  return points.map((_, i) => {
    if (i > 0) run += lengths[i - 1]!
    return total === 0 ? 0 : run / total
  })
}

/** Irregular closed ring for pit benches: an ellipse with a little wobble. */
function ring(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const pts: Point[] = []
  const steps = 72
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const wobble = 1 + 0.05 * Math.sin(3 * t + seed) + 0.03 * Math.cos(5 * t + seed * 1.7)
    pts.push([cx + Math.cos(t) * rx * wobble, cy + Math.sin(t) * ry * wobble])
  }
  return polyline(pts) + ' Z'
}

/* -------------------------------------------------------------------------- */
/* Shared drawing parts                                                       */
/* -------------------------------------------------------------------------- */

const label = 'fill-fg-muted text-[13px] max-sm:hidden'
const structure = 'fill-surface-raised stroke-fg'

function Label({
  x,
  y,
  children,
  anchor = 'start',
}: {
  x: number
  y: number
  children: ReactNode
  anchor?: 'start' | 'middle' | 'end'
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={label}>
      {children}
    </text>
  )
}

/** Sheet frame: border, edge ticks every 40 units, corner coordinates. */
function Frame({ nw, se, coordinates = true }: { nw: string; se: string; coordinates?: boolean }) {
  const ticksX = Array.from({ length: PLAN_WIDTH / 40 - 1 }, (_, i) => (i + 1) * 40)
  const ticksY = Array.from({ length: Math.floor(PLAN_HEIGHT / 40) }, (_, i) => (i + 1) * 40)
  return (
    <g>
      <rect
        x="0.5"
        y="0.5"
        width={PLAN_WIDTH - 1}
        height={PLAN_HEIGHT - 1}
        className="fill-none stroke-line"
      />
      <g className="stroke-line" strokeWidth="1">
        {ticksX.map((x) => (
          <path key={`tx${x}`} d={`M${x} 0 V7 M${x} ${PLAN_HEIGHT} V${PLAN_HEIGHT - 7}`} />
        ))}
        {ticksY.map((y) => (
          <path key={`ty${y}`} d={`M0 ${y} H7 M${PLAN_WIDTH} ${y} H${PLAN_WIDTH - 7}`} />
        ))}
      </g>
      {coordinates ? (
        <>
          <text x="12" y="22" className="fill-fg-muted text-[11px] max-md:hidden">
            {nw}
          </text>
          <text
            x={PLAN_WIDTH - 12}
            y={PLAN_HEIGHT - 12}
            textAnchor="end"
            className="fill-fg-muted text-[11px] max-md:hidden"
          >
            {se}
          </text>
        </>
      ) : null}
    </g>
  )
}

/** North arrow and a 100 m scale bar, bottom-left of the sheet. */
function NorthAndScale({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="max-sm:hidden">
      <path d="M0 -26 L6 -10 L0 -14 L-6 -10 Z" className="fill-fg" />
      <text x="0" y="-30" textAnchor="middle" className="fill-fg text-[11px] font-semibold">
        N
      </text>
      <g transform="translate(18 -8)">
        <path d="M0 0 H60 M0 -4 V4 M30 -3 V3 M60 -4 V4" className="stroke-fg" strokeWidth="1.25" />
        <rect x="0" y="-2" width="30" height="4" className="fill-fg" />
        <text x="64" y="4" className="fill-fg-muted text-[11px]">
          100 m
        </text>
      </g>
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* Refinery: tank farm, pipe rack, process units, flare                       */
/* -------------------------------------------------------------------------- */

const tanks: { id: string; x: number; y: number }[] = [
  { id: 'TK-101', x: 104, y: 106 },
  { id: 'TK-102', x: 176, y: 106 },
  { id: 'TK-103', x: 248, y: 106 },
  { id: 'TK-104', x: 104, y: 184 },
  { id: 'TK-105', x: 176, y: 184 },
  { id: 'TK-106', x: 248, y: 184 },
]

function RefineryDrawing() {
  return (
    <>
      <g className="fill-none stroke-contour" strokeWidth="1" opacity="0.7">
        <path d="M0 330 C 70 318, 120 340, 190 332 S 300 300, 350 312" />
        <path d="M0 356 C 80 344, 140 366, 210 358 S 320 330, 380 342" />
        <path d="M0 384 C 90 372, 160 394, 230 386 S 340 360, 420 372 S 560 392, 640 384" />
        <path d="M640 52 C 610 70, 600 90, 612 116" />
      </g>

      {/* Site road */}
      <path
        d="M0 292 H640 M318 292 V0"
        className="fill-none stroke-surface-shade"
        strokeWidth="14"
      />
      <path
        d="M0 285 H311 V0 M325 0 V285 H640 M0 299 H640"
        className="fill-none stroke-line"
        strokeWidth="1"
      />

      {/* Tank farm: bund wall and floating-roof tanks */}
      <rect
        x="62"
        y="64"
        width="228"
        height="162"
        className="fill-none stroke-fg-muted"
        strokeWidth="1"
        strokeDasharray="5 4"
      />
      <g className={structure} strokeWidth="1.25">
        {tanks.map((t) => (
          <g key={t.id}>
            <circle cx={t.x} cy={t.y} r="29" />
            <circle
              cx={t.x}
              cy={t.y}
              r="22"
              className="fill-none stroke-fg-muted"
              strokeWidth="0.75"
            />
          </g>
        ))}
      </g>
      <Label x={62} y={246}>
        Tank farm
      </Label>

      {/* Pipe rack from the tank farm to the units */}
      <path
        d="M290 146 H454 M290 154 H454 M454 146 V176 M462 146 V176"
        className="fill-none stroke-fg"
        strokeWidth="1.25"
      />
      <g className="stroke-fg-muted" strokeWidth="1">
        {Array.from({ length: 8 }, (_, i) => 344 + i * 15).map((x) => (
          <path key={x} d={`M${x} 142 V158`} />
        ))}
      </g>
      <Label x={290} y={176}>
        Pipe rack PR-3
      </Label>

      {/* Process units */}
      <g className={structure} strokeWidth="1.25">
        <rect x="350" y="40" width="132" height="70" rx="2" />
        <rect x="402" y="176" width="116" height="84" rx="2" />
        <rect x="508" y="40" width="96" height="86" rx="2" />
      </g>
      <g className="fill-surface stroke-fg" strokeWidth="1.25">
        <circle cx="374" cy="74" r="10" />
        <circle cx="402" cy="74" r="7" />
        <circle cx="424" cy="74" r="7" />
        <circle cx="430" cy="218" r="12" />
        <circle cx="462" cy="218" r="8" />
        <rect x="524" y="58" width="22" height="50" />
        <rect x="560" y="58" width="28" height="22" />
      </g>
      <Label x={350} y={128}>
        Crude unit
      </Label>
      <Label x={508} y={144}>
        Cracker
      </Label>
      <Label x={402} y={278}>
        Hydrotreater
      </Label>

      {/* Flare with its exclusion zone */}
      <circle
        cx="560"
        cy="346"
        r="44"
        className="fill-none stroke-contour"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <circle cx="560" cy="346" r="6" className="fill-fg" />
      <Label x={560} y={374} anchor="middle">
        Flare F-1
      </Label>

      {/* Control room */}
      <rect x="196" y="318" width="64" height="40" className={structure} strokeWidth="1.25" />
      <Label x={196} y={376}>
        Control room
      </Label>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Substation: gantry, busbars, bays, transformers                            */
/* -------------------------------------------------------------------------- */

const bays = [128, 196, 264, 332, 400, 468]

function Transformer({ x, y, id }: { x: number; y: number; id: string }) {
  return (
    <g>
      <g className="stroke-fg" strokeWidth="1">
        {Array.from({ length: 6 }, (_, i) => y + 8 + i * 9).map((fy) => (
          <path key={fy} d={`M${x - 7} ${fy} H${x} M${x + 70} ${fy} H${x + 77}`} />
        ))}
      </g>
      <rect x={x} y={y} width="70" height="56" rx="2" className={structure} strokeWidth="1.25" />
      <g className="fill-surface stroke-fg" strokeWidth="1.25">
        <circle cx={x + 18} cy={y + 12} r="5" />
        <circle cx={x + 35} cy={y + 12} r="5" />
        <circle cx={x + 52} cy={y + 12} r="5" />
      </g>
      <text
        x={x + 35}
        y={y + 42}
        textAnchor="middle"
        className="fill-fg text-[13px] font-semibold max-sm:hidden"
      >
        {id}
      </text>
    </g>
  )
}

function SubstationDrawing() {
  return (
    <>
      <g className="fill-none stroke-contour" strokeWidth="1" opacity="0.7">
        <path d="M0 384 C 120 372, 210 398, 330 388 S 520 370, 640 380" />
        <path d="M0 404 C 130 394, 240 414, 360 406 S 540 392, 640 400" />
      </g>

      {/* Incoming transmission lines and gantry */}
      <g className="stroke-fg" strokeWidth="1.25">
        <path d="M168 0 V74 M236 0 V74 M304 0 V74" />
      </g>
      <rect x="140" y="66" width="192" height="10" className={structure} strokeWidth="1.25" />

      {/* Fence */}
      <rect
        x="64"
        y="54"
        width="508"
        height="318"
        className="fill-none stroke-fg-muted"
        strokeWidth="1"
        strokeDasharray="6 4"
      />
      <Label x={572} y={48} anchor="end">
        Fence line
      </Label>

      {/* Busbars */}
      <g className="stroke-fg" strokeWidth="2.25">
        <path d="M96 120 H512" />
        <path d="M96 138 H512" />
      </g>
      <path d="M168 76 V120 M236 76 V120 M304 76 V120" className="stroke-fg" strokeWidth="1.25" />
      <Label x={520} y={134}>
        Bus A, B
      </Label>

      {/* Bays: disconnect, breaker, disconnect, down to transformers */}
      {bays.map((x, i) => (
        <g key={x} className="stroke-fg" strokeWidth="1.25">
          <path d={`M${x} 138 V160 M${x} 168 L${x + 7} 160 M${x} 168 V188`} className="fill-none" />
          <rect x={x - 7} y="188" width="14" height="14" className="fill-surface-raised" />
          <path d={`M${x} 202 V220 M${x} 228 L${x + 7} 220 M${x} 228 V262`} className="fill-none" />
          <text
            x={x}
            y="256"
            dx="10"
            className="fill-fg-muted stroke-none text-[11px] max-md:hidden"
          >
            {i + 1}
          </text>
        </g>
      ))}

      <Transformer x={127} y={262} id="T1" />
      <Transformer x={263} y={262} id="T2" />
      <Transformer x={399} y={262} id="T3" />

      {/* Control building */}
      <rect
        x="500"
        y="262"
        width="56"
        height="74"
        rx="2"
        className={structure}
        strokeWidth="1.25"
      />
      <Label x={500} y={356}>
        Control
      </Label>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Open-pit mine: benched rings, haul road, waste dump                        */
/* -------------------------------------------------------------------------- */

const pit = { cx: 292, cy: 214 }
const benchRings = [
  { rx: 236, ry: 150 },
  { rx: 202, ry: 128 },
  { rx: 168, ry: 106 },
  { rx: 136, ry: 85 },
  { rx: 104, ry: 64 },
  { rx: 74, ry: 45 },
  { rx: 46, ry: 27 },
].map((r, i) => ({ ...r, d: ring(pit.cx, pit.cy, r.rx, r.ry, i * 0.35) }))

/** Haul road: spirals from the rim on the east side down to the pit floor. */
const haulRoad = (() => {
  const pts: Point[] = []
  const steps = 64
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const t = -0.15 * Math.PI + f * 1.75 * Math.PI
    const rx = 250 - f * 196
    const ry = 158 - f * 124
    pts.push([pit.cx + Math.cos(t) * rx, pit.cy + Math.sin(t) * ry])
  }
  return polyline(pts)
})()

function OpenPitDrawing() {
  return (
    <>
      {/* Waste dump, hatched */}
      <defs>
        <pattern
          id="hl-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M0 0 V8" className="stroke-contour" strokeWidth="1" />
        </pattern>
      </defs>
      <path
        d="M520 22 L618 30 L626 128 L560 118 L532 74 Z"
        fill="url(#hl-hatch)"
        className="stroke-contour"
        strokeWidth="1"
      />
      <Label x={540} y={146}>
        Waste dump
      </Label>

      {/* Benches: crest lines in ink, toes in sage */}
      <g className="fill-none">
        {benchRings.map((b, i) => (
          <path
            key={b.rx}
            d={b.d}
            className={i % 2 === 0 ? 'stroke-fg' : 'stroke-contour'}
            strokeWidth={i === 0 ? 1.5 : 1}
            opacity={i === 0 ? 1 : 0.85}
          />
        ))}
      </g>
      <ellipse
        cx={pit.cx}
        cy={pit.cy}
        rx="26"
        ry="14"
        className="fill-surface-shade stroke-contour"
      />
      <Label x={pit.cx} y={pit.cy + 4} anchor="middle">
        Sump
      </Label>

      {/* Haul road with casing */}
      <path d={haulRoad} className="fill-none stroke-fg" strokeWidth="9" strokeLinecap="round" />
      <path
        d={haulRoad}
        className="fill-none stroke-surface-raised"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M534 182 L600 176" className="fill-none stroke-fg" strokeWidth="9" />
      <path d="M534 182 L600 176" className="fill-none stroke-surface-raised" strokeWidth="6" />

      {/* Crusher at the rim */}
      <rect
        x="596"
        y="160"
        width="30"
        height="30"
        rx="2"
        className={structure}
        strokeWidth="1.25"
      />
      <Label x={632} y={212} anchor="end">
        Crusher
      </Label>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Port terminal: fence line, container yards, quay cranes, berths            */
/* -------------------------------------------------------------------------- */

const QUAY_Y = 312
const stackRows = [84, 120, 156, 192, 228]
const yards = [
  { x: 64, label: 'Terminal 1' },
  { x: 306, label: 'Terminal 2' },
]
const quayCranes = [
  { x: 118, id: 'QC-1' },
  { x: 206, id: 'QC-2' },
  { x: 358, id: 'QC-3' },
  { x: 446, id: 'QC-4' },
]

function PortDrawing() {
  return (
    <>
      {/* Water, with sage swell lines */}
      <rect
        x="0"
        y={QUAY_Y}
        width={PLAN_WIDTH}
        height={PLAN_HEIGHT - QUAY_Y}
        className="fill-surface-shade"
      />
      <g className="fill-none stroke-contour" strokeWidth="1" opacity="0.7">
        <path d="M0 366 C 60 360, 120 372, 180 366 S 300 360, 360 366 S 460 372, 510 366" />
        <path d="M0 398 C 70 392, 140 404, 210 398 S 340 392, 410 398 S 480 404, 510 398" />
      </g>

      {/* Cruise pier */}
      <rect x="520" y="230" width="72" height="168" className={structure} strokeWidth="1.25" />
      <Label x={512} y={410} anchor="end">
        Cruise berth C1
      </Label>

      {/* Quay edge with fender ticks */}
      <path d={`M0 ${QUAY_Y} H520`} className="stroke-fg" strokeWidth="1.75" />
      <g className="stroke-fg-muted" strokeWidth="1">
        {Array.from({ length: 16 }, (_, i) => 20 + i * 31).map((x) => (
          <path key={x} d={`M${x} ${QUAY_Y} V${QUAY_Y + 5}`} />
        ))}
      </g>
      <Label x={24} y={QUAY_Y + 24}>
        Berth 1
      </Label>
      <Label x={270} y={QUAY_Y + 24}>
        Berth 3
      </Label>

      {/* Perimeter fence, open to the water */}
      <path
        d={`M30 ${QUAY_Y - 12} V140 M30 108 V40 H610 V${QUAY_Y - 12}`}
        className="fill-none stroke-fg-muted"
        strokeWidth="1"
        strokeDasharray="6 4"
      />
      <Label x={36} y={117}>
        Gate 1
      </Label>
      <Label x={610} y={30} anchor="end">
        Fence line
      </Label>

      {/* Container yards: stack rows with bay divisions */}
      {yards.map((yard) => (
        <g key={yard.label}>
          <g className={structure} strokeWidth="1.25">
            {stackRows.map((y) => (
              <rect key={y} x={yard.x} y={y} width="186" height="22" rx="1" />
            ))}
          </g>
          <g className="stroke-fg-muted" strokeWidth="0.75">
            {stackRows.map((y) =>
              Array.from({ length: 14 }, (_, i) => yard.x + 12.4 * (i + 1)).map((x) => (
                <path key={`${y}-${x}`} d={`M${r1(x)} ${y + 3} V${y + 19}`} />
              )),
            )}
          </g>
          <Label x={yard.x} y={270}>
            {yard.label}
          </Label>
        </g>
      ))}

      {/* Admin building and lighting masts */}
      <rect x="520" y="78" width="64" height="56" rx="2" className={structure} strokeWidth="1.25" />
      <Label x={520} y={152}>
        Admin
      </Label>
      <g className="fill-surface stroke-fg" strokeWidth="1.25">
        {[
          [276, 92],
          [276, 236],
          [508, 196],
          [56, 286],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />
        ))}
      </g>

      {/* Ship-to-shore cranes straddling the quay, booms out over the water */}
      {quayCranes.map((c) => (
        <g key={c.id}>
          <path
            d={`M${c.x + 11} ${QUAY_Y + 14} V${QUAY_Y + 50}`}
            className="stroke-fg"
            strokeWidth="2"
          />
          <rect
            x={c.x}
            y={QUAY_Y - 22}
            width="22"
            height="36"
            rx="1"
            className={structure}
            strokeWidth="1.25"
          />
          <text
            x={c.x + 11}
            y={QUAY_Y - 30}
            textAnchor="middle"
            className="fill-fg text-[11px] font-semibold max-md:hidden"
          >
            {c.id}
          </text>
        </g>
      ))}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Solar farm: tracker blocks, inverter stations, substation                  */
/* -------------------------------------------------------------------------- */

const solarBlocks = [
  { id: 'A', x: 64, y: 56 },
  { id: 'B', x: 334, y: 56 },
  { id: 'C', x: 64, y: 232 },
  { id: 'D', x: 334, y: 232 },
]
const BLOCK_W = 222
const BLOCK_H = 132

function SolarDrawing() {
  return (
    <>
      <g className="fill-none stroke-contour" strokeWidth="1" opacity="0.7">
        <path d="M0 24 C 120 14, 260 30, 380 20 S 560 10, 640 22" />
        <path d="M600 260 C 612 300, 606 350, 622 410" />
      </g>

      {/* Access roads */}
      <path
        d="M30 210 H600 M310 34 V392"
        className="fill-none stroke-surface-shade"
        strokeWidth="14"
      />
      <path
        d="M30 203 H303 V34 M317 34 V203 H600 M30 217 H303 V392 M317 392 V217 H600"
        className="fill-none stroke-line"
        strokeWidth="1"
      />

      {/* Fence */}
      <rect
        x="40"
        y="34"
        width="544"
        height="358"
        className="fill-none stroke-fg-muted"
        strokeWidth="1"
        strokeDasharray="6 4"
      />

      {/* Tracker rows: single-axis trackers run north to south */}
      {solarBlocks.map((b) => (
        <g key={b.id}>
          <g className={structure} strokeWidth="1">
            {Array.from({ length: 13 }, (_, i) => b.x + i * 17).map((x) => (
              <rect key={x} x={x} y={b.y} width="9" height={BLOCK_H} rx="1" />
            ))}
          </g>
          <g className="stroke-fg-muted" strokeWidth="0.75">
            {Array.from({ length: 13 }, (_, i) => b.x + i * 17).map((x) => (
              <path key={x} d={`M${x + 4.5} ${b.y + 2} V${b.y + BLOCK_H - 2}`} />
            ))}
          </g>
          <text
            x={b.x + BLOCK_W - 4}
            y={b.y < 200 ? b.y - 6 : b.y + BLOCK_H + 18}
            textAnchor="end"
            className="fill-fg-muted text-[13px] max-sm:hidden"
          >
            Block {b.id}
          </text>
        </g>
      ))}

      {/* Inverter stations on the east-west road */}
      <g className={structure} strokeWidth="1.25">
        <rect x="166" y="200" width="20" height="20" rx="1" />
        <rect x="436" y="200" width="20" height="20" rx="1" />
      </g>
      <Label x={190} y={214}>
        INV-1
      </Label>
      <Label x={460} y={214}>
        INV-2
      </Label>

      {/* Substation outside the fence */}
      <rect
        x="596"
        y="184"
        width="36"
        height="52"
        rx="2"
        className={structure}
        strokeWidth="1.25"
      />
      <Label x={634} y={176} anchor="end">
        Substation
      </Label>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Specs                                                                      */
/* -------------------------------------------------------------------------- */

const refineryRoute: Point[] = [
  [52, 382],
  [30, 268],
  [36, 40],
  [304, 30],
  [304, 150],
  [480, 150],
  [618, 156],
  [618, 266],
  [488, 304],
  [430, 396],
  [160, 398],
  [52, 382],
]

const substationRoute: Point[] = [
  [40, 396],
  [604, 396],
  [604, 98],
  [456, 98],
  [456, 238],
  [388, 238],
  [388, 98],
  [320, 98],
  [320, 238],
  [252, 238],
  [252, 98],
  [184, 98],
  [184, 238],
  [116, 238],
  [116, 98],
  [40, 98],
  [40, 396],
]

const openPitRoute: Point[] = [
  [36, 396],
  [30, 214],
  [110, 62],
  [292, 34],
  [470, 60],
  [560, 230],
  [470, 376],
  [292, 398],
  [170, 352],
  [292, 300],
  [420, 214],
  [292, 130],
  [170, 214],
  [36, 396],
]

const portRoute: Point[] = [
  [56, 66],
  [44, 48],
  [598, 48],
  [598, 214],
  [556, 392],
  [500, 346],
  [100, 346],
  [290, 290],
  [290, 70],
  [56, 66],
]

const solarRoute: Point[] = [
  [52, 210],
  [52, 88],
  [574, 88],
  [574, 160],
  [52, 160],
  [52, 264],
  [574, 264],
  [574, 336],
  [52, 336],
  [52, 210],
]

export const sitePlans: Record<SiteType, SitePlanSpec> = {
  refinery: {
    site: 'refinery',
    title: 'Inspection route over a refinery',
    description:
      'The drone leaves its dock, circles the tank farm at shell height, follows pipe rack PR-3 to the process units and keeps clear of the flare exclusion zone on the way back.',
    coordinates: { nw: '29°43′52″N 95°09′41″W', se: '29°43′31″N 95°09′02″W' },
    dock: [52, 382],
    route: refineryRoute,
    waypoints: [1, 2, 3, 4, 6, 7, 8, 9, 10],
    anchors: [
      { at: [104, 184], label: [146, 236], asset: 'TK-104 shell' },
      { at: [400, 150], label: [332, 306], asset: 'PR-3, bent 12' },
      { at: [374, 74], label: [400, 8], asset: 'C-1 column' },
    ],
    scale: [300, 372],
    detail: [8, 0, 512, 330],
    drawing: RefineryDrawing,
  },
  substation: {
    site: 'substation',
    title: 'Inspection route over a power substation',
    description:
      'The drone leaves its dock outside the fence, circles the yard, then flies low along each of the six bays in turn, reading every phase before it lands.',
    coordinates: { nw: '41°52′10″N 87°38′44″W', se: '41°51′59″N 87°38′21″W' },
    dock: [40, 396],
    route: substationRoute,
    waypoints: [1, 2, 3, 5, 7, 9, 11, 13, 15],
    anchors: [
      { at: [298, 274], label: [224, 334], asset: 'T2 HV bushing' },
      { at: [332, 212], label: [380, 334], asset: 'Bay 4 clamp' },
      { at: [400, 120], label: [476, 148], asset: 'Bus A joint' },
    ],
    scale: [100, 360],
    detail: [96, 56, 470, 308],
    drawing: SubstationDrawing,
  },
  'open-pit': {
    site: 'open-pit',
    title: 'Survey route over an open-pit mine',
    description:
      'The drone leaves its dock on the west rim, flies the pit crest all the way round, then a tighter lap over the lower benches before landing.',
    coordinates: { nw: '23°21′40″S 119°43′12″E', se: '23°22′05″S 119°42′31″E' },
    dock: [36, 396],
    route: openPitRoute,
    waypoints: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    anchors: [
      { at: [190, 92], label: [212, 102], asset: 'Bench 5 crest' },
      { at: [520, 196], label: [418, 156], asset: 'Ramp R2' },
      { at: [246, 268], label: [306, 330], asset: 'Bench 3 toe' },
    ],
    scale: [84, 400],
    detail: [80, 30, 500, 328],
    drawing: OpenPitDrawing,
  },
  port: {
    site: 'port',
    title: 'Night patrol route over a port terminal',
    description:
      'The drone leaves its dock inside Gate 1, flies the whole fence line, rounds the cruise pier, runs back along the berths under the quay-crane booms and returns up the road between the container yards.',
    coordinates: { nw: '57°42′06″N 11°48′32″E', se: '57°41′44″N 11°49′18″E' },
    dock: [56, 66],
    route: portRoute,
    waypoints: [1, 2, 3, 4, 5, 6, 7, 8],
    anchors: [
      { at: [420, 40], label: [392, 54], asset: 'North fence, panel 41' },
      { at: [369, 300], label: [370, 362], asset: 'QC-3 hoist brake' },
      { at: [160, 156], label: [96, 190], asset: 'Row C, bay 18' },
    ],
    scale: [40, 412],
    detail: [20, 20, 600, 392],
    drawing: PortDrawing,
  },
  'solar-farm': {
    site: 'solar-farm',
    title: 'Thermal survey route over a solar farm',
    description:
      'The drone leaves its dock at the west gate and flies a lawnmower pattern over the four tracker blocks at 60 m, reading every string, then checks both inverter stations before landing.',
    coordinates: { nw: '37°24′31″N 5°56′44″W', se: '37°24′02″N 5°55′51″W' },
    dock: [52, 210],
    route: solarRoute,
    waypoints: [1, 2, 3, 4, 5, 6, 7, 8],
    anchors: [
      { at: [453, 120], label: [462, 100], asset: 'B-14, string 6' },
      { at: [183, 300], label: [196, 296], asset: 'C-07 module' },
      { at: [446, 210], label: [470, 238], asset: 'INV-2 terminal' },
    ],
    scale: [330, 414],
    detail: [30, 24, 570, 380],
    drawing: SolarDrawing,
  },
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export interface PlanCallout {
  /** Text in the callout plate; omitted callouts show the marker only. */
  label?: string
}

export interface SitePlanProps {
  site: SiteType
  /** Callouts for the plan's finding anchors, in order. Defaults to the anchors' asset IDs. */
  callouts?: PlanCallout[]
  /** Draw the route on mount (and each time the plan is shown again). */
  animate?: boolean
  /** Hide the route and findings: the bare plan. */
  bare?: boolean
  className?: string
  /** Unique prefix for SVG ids when several plans share a page. */
  idPrefix: string
  /** Show the detail crop around the findings instead of the whole sheet. */
  detail?: boolean
}

const DRAW_SECONDS = 2.2
const DRAW_DELAY = 0.25

export function SitePlan({
  site,
  callouts,
  animate = true,
  bare = false,
  className,
  idPrefix,
  detail = false,
}: SitePlanProps) {
  const spec = sitePlans[site]
  const progress = routeProgress(spec.route)
  const titleId = `${idPrefix}-title`
  const descId = `${idPrefix}-desc`
  const Drawing = spec.drawing
  const shown = (callouts ?? spec.anchors.map((a) => ({ label: a.asset }))).slice(
    0,
    spec.anchors.length,
  )
  const findingsAt = DRAW_DELAY + DRAW_SECONDS + 0.1

  return (
    <svg
      viewBox={detail ? spec.detail.join(' ') : `0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className={cn('block h-auto w-full', animate && 'hl-animate', className)}
    >
      <title id={titleId}>{spec.title}</title>
      <desc id={descId}>{spec.description}</desc>

      <Frame nw={spec.coordinates.nw} se={spec.coordinates.se} coordinates={!detail} />
      <Drawing />

      {/* Dock */}
      <rect
        x={spec.dock[0] - 10}
        y={spec.dock[1] - 10}
        width="20"
        height="20"
        className="fill-fg"
      />

      {bare ? null : (
        <>
          <path
            d={polyline(spec.route)}
            pathLength={1}
            className="hl-route fill-none stroke-accent"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {spec.waypoints.map((i) => {
            const p = spec.route[i]
            if (!p) return null
            return (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r="5.5"
                className="hl-mark fill-surface stroke-accent"
                strokeWidth="2.25"
                style={{
                  ['--mark-delay' as string]: `${DRAW_DELAY + (progress[i] ?? 0) * DRAW_SECONDS}s`,
                }}
              />
            )
          })}

          {shown.map((c, i) => {
            const a = spec.anchors[i]
            if (!a) return null
            const text = c.label
            const w = text ? Math.min(200, text.length * 7.4 + 22) : 0
            const delay = `${findingsAt + i * 0.18}s`
            return (
              <g key={a.asset} className="hl-mark" style={{ ['--mark-delay' as string]: delay }}>
                {text ? (
                  <g className="max-sm:hidden">
                    <path
                      d={`M${a.at[0]} ${a.at[1]} L${a.label[0] + 10} ${a.label[1] + 13}`}
                      className="stroke-fg"
                      strokeWidth="1"
                    />
                    <rect
                      x={a.label[0]}
                      y={a.label[1]}
                      width={w}
                      height="26"
                      rx="3"
                      className="fill-surface stroke-fg"
                      strokeWidth="1"
                    />
                    <circle
                      cx={a.label[0] + 12}
                      cy={a.label[1] + 13}
                      r="4"
                      className="fill-signal"
                    />
                    <text
                      x={a.label[0] + 22}
                      y={a.label[1] + 17.5}
                      className="fill-fg text-[13px] font-semibold"
                    >
                      {text}
                    </text>
                  </g>
                ) : null}
                <circle cx={a.at[0]} cy={a.at[1]} r="15" className="fill-signal" opacity="0.28" />
                <circle
                  cx={a.at[0]}
                  cy={a.at[1]}
                  r="6.5"
                  className="fill-signal stroke-fg"
                  strokeWidth="1.5"
                />
              </g>
            )
          })}
        </>
      )}

      <NorthAndScale x={spec.scale[0]} y={spec.scale[1]} />
    </svg>
  )
}
