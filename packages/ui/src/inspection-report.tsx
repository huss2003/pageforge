import type { SiteType } from '@pageforge/blocks'
import { cn } from './cn'
import { RouteGlyph } from './primitives/glyphs'
import { tokens } from './tokens'

/**
 * A slice of Hoverline's own app: one finding from one flight, the way an
 * engineer sees it the morning after. Built as real interface, not a picture
 * of one, so its insides follow app-screen rules (`data-ui`): 1px borders,
 * small sentence-case labels, a pale status chip, right-aligned figures.
 */

export type Severity = 'low' | 'medium' | 'high'

export interface InspectionFinding {
  site: SiteType
  siteName: string
  flight: string
  asset: string
  location: string
  /** What the reading measures. Thermal readings show the ramp swatch. */
  kind: 'thermal' | 'displacement'
  reading: number
  baseline: number
  unit: string
  baselineNote: string
  capturedAt: string
  severity: Severity
  workOrder: { id: string; team: string; due: string; status: string }
  /** Other findings on the same flight, for the list under the card. */
  others: { asset: string; note: string; severity: Severity }[]
}

export const sampleFindings: Record<SiteType, InspectionFinding> = {
  refinery: {
    site: 'refinery',
    siteName: 'Bayou Gate terminal',
    flight: 'Flight 0614-B',
    asset: 'TK-104',
    location: 'Shell, course 3, 40° from north',
    kind: 'thermal',
    reading: 71.2,
    baseline: 53.1,
    unit: '°C',
    baselineNote: '7-day median',
    capturedAt: '2026-10-14 06:21',
    severity: 'high',
    workOrder: { id: 'WO-48213', team: 'Mechanical, day shift', due: 'Due today', status: 'Open' },
    others: [
      { asset: 'PR-3, bent 12', note: 'Coating loss, 0.4 m²', severity: 'medium' },
      { asset: 'C-1 column', note: 'Insulation gap, 22 m', severity: 'low' },
    ],
  },
  substation: {
    site: 'substation',
    siteName: 'Kestrel Road 138 kV',
    flight: 'Flight 2207-A',
    asset: 'T2',
    location: 'HV bushing, phase A',
    kind: 'thermal',
    reading: 84.0,
    baseline: 53.0,
    unit: '°C',
    baselineNote: 'phase B, same scan',
    capturedAt: '2026-10-14 05:48',
    severity: 'high',
    workOrder: { id: 'WO-11752', team: 'Substation crew 2', due: 'Due in 2 days', status: 'Open' },
    others: [
      { asset: 'Bay 4 clamp', note: 'Two broken strands', severity: 'medium' },
      { asset: 'Bus A joint', note: '12 °C over ambient', severity: 'low' },
    ],
  },
  'open-pit': {
    site: 'open-pit',
    siteName: 'Coldwater Range pit',
    flight: 'Flight 0530-N',
    asset: 'Bench 5',
    location: 'North wall crest, section N-14',
    kind: 'displacement',
    reading: 14,
    baseline: 0,
    unit: 'mm',
    baselineNote: 'survey of 7 Oct',
    capturedAt: '2026-10-14 05:30',
    severity: 'high',
    workOrder: { id: 'WO-90377', team: 'Geotechnical', due: 'Due today', status: 'Open' },
    others: [
      { asset: 'Ramp R2', note: 'Grade 9.4 %, two potholes', severity: 'medium' },
      { asset: 'Bench 3 toe', note: 'New water seep, 6 m', severity: 'low' },
    ],
  },
  port: {
    site: 'port',
    siteName: 'Harbour terminal 2',
    flight: 'Flight 0212-P',
    asset: 'QC-3',
    location: 'Hoist brake, landside drum',
    kind: 'thermal',
    reading: 96.5,
    baseline: 58.0,
    unit: '°C',
    baselineNote: 'QC-2, same flight',
    capturedAt: '2026-10-14 02:12',
    severity: 'high',
    workOrder: {
      id: 'WO-30418',
      team: 'Crane maintenance',
      due: 'Due before next shift',
      status: 'Open',
    },
    others: [
      { asset: 'North fence, panel 41', note: 'Lifted at the base, 40 cm', severity: 'medium' },
      { asset: 'Row C, bay 18', note: 'Container door open', severity: 'low' },
    ],
  },
  'solar-farm': {
    site: 'solar-farm',
    siteName: 'Ridgeback solar, 120 MW',
    flight: 'Flight 1130-S',
    asset: 'C-07',
    location: 'Tracker row 12, module 31',
    kind: 'thermal',
    reading: 88.4,
    baseline: 51.2,
    unit: '°C',
    baselineNote: 'row median',
    capturedAt: '2026-10-14 11:30',
    severity: 'medium',
    workOrder: { id: 'WO-62094', team: 'O&M crew 1', due: 'Due this week', status: 'Open' },
    others: [
      { asset: 'B-14, string 6', note: 'String running cold', severity: 'medium' },
      { asset: 'INV-2 terminal', note: '24 °C over neighbours', severity: 'low' },
    ],
  },
}

const severityLabel: Record<Severity, string> = { low: 'Low', medium: 'Medium', high: 'High' }

const severityChip: Record<Severity, string> = {
  high: 'bg-signal-wash text-signal-ink',
  medium: 'bg-surface-shade text-fg',
  low: 'bg-surface-shade text-fg-muted',
}

/* -------------------------------------------------------------------------- */
/* Thermal crop: a low-resolution radiometric grid, quantised to the ramp.    */
/* -------------------------------------------------------------------------- */

const ramp = [
  tokens.color.thermal0,
  tokens.color.thermal1,
  tokens.color.thermal2,
  tokens.color.thermal3,
  tokens.color.thermal4,
  tokens.color.thermal5,
]

const COLS = 40
const ROWS = 24
const T_MIN = 20
const T_MAX = 80

function rampIndex(t: number) {
  const f = (t - T_MIN) / (T_MAX - T_MIN)
  return Math.max(0, Math.min(ramp.length - 1, Math.floor(f * ramp.length)))
}

/** Deterministic noise so the server and client render the same grid. */
function noise(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function thermalField(kind: InspectionFinding['kind'], hotspot: [number, number], peak: number) {
  const cells: { x: number; y: number; t: number }[] = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let t: number
      if (kind === 'thermal') {
        // Sky above, the asset below: warm metal with cooler weld seams and
        // one hot spot that climbs the whole ramp.
        const sky = y < 4 || (x > 33 && y < 10)
        const seam = y % 7 === 0 ? -6 : 0
        const shade = (x / COLS) * 6
        const d = Math.hypot(x - hotspot[0], (y - hotspot[1]) * 1.25)
        const base = sky ? 22 : 43 + shade + seam
        t = base + (peak - 44) * Math.exp(-(d * d) / 16) + noise(x, y) * 1.5
      } else {
        // Displacement: still ground in slate, the moving block on the crest.
        const d = Math.hypot(x - hotspot[0], (y - hotspot[1]) * 1.6)
        const crest = y < 7 ? 4 : 0
        t = 30 + crest + 48 * Math.exp(-(d * d) / 36) + noise(x, y) * 4
      }
      cells.push({ x, y, t })
    }
  }
  return cells
}

function ThermalCrop({ finding }: { finding: InspectionFinding }) {
  const hot: [number, number] = finding.kind === 'thermal' ? [25, 12] : [18, 5]
  const cells = thermalField(finding.kind, hot, finding.kind === 'thermal' ? finding.reading : 0)
  const box = { x: hot[0] - 5, y: hot[1] - 4, w: 10, h: 8 }
  return (
    <svg
      viewBox={`0 0 ${COLS} ${ROWS}`}
      preserveAspectRatio="none"
      className="block aspect-[5/3] w-full"
      role="img"
      aria-label={
        finding.kind === 'thermal'
          ? `Thermal image of ${finding.asset}: one hot spot at ${finding.reading} ${finding.unit}`
          : `Displacement map of ${finding.asset}: ${finding.reading} ${finding.unit} movement on the crest`
      }
      shapeRendering="crispEdges"
    >
      {cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          x={c.x}
          y={c.y}
          width="1.02"
          height="1.02"
          fill={ramp[rampIndex(c.t)]}
        />
      ))}
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.25"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M${hot[0] - 1.2} ${hot[1]} H${hot[0] + 1.2} M${hot[0]} ${hot[1] - 1.2} V${hot[1] + 1.2}`}
        stroke="#ffffff"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function formatReading(n: number, unit: string) {
  const v = unit === 'mm' ? n.toFixed(0) : n.toFixed(1)
  return `${v} ${unit}`
}

function formatDelta(n: number, unit: string) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${formatReading(Math.abs(n), unit)}`
}

/** Where the reading sits on the ramp: a small swatch strip with a marker. */
function RampSwatch({ value }: { value: number }) {
  const f = Math.max(0, Math.min(1, (value - T_MIN) / (T_MAX - T_MIN)))
  return (
    <div className="w-full max-w-44">
      <div
        className="relative flex h-2.5 overflow-hidden rounded-[2px] ring-1 ring-line"
        aria-hidden="true"
      >
        {ramp.map((c) => (
          <span key={c} className="h-full flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="relative h-2" aria-hidden="true">
        <span
          className="absolute top-0 h-2 w-0.5 -translate-x-1/2 bg-fg"
          style={{ left: `${f * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-fg-muted">
        <span>{T_MIN}&nbsp;°C</span>
        <span>{T_MAX}&nbsp;°C</span>
      </div>
    </div>
  )
}

export interface InspectionReportProps {
  site?: SiteType
  /** Override the sample finding entirely. */
  finding?: InspectionFinding
  /** Hide the list of other findings: just the card. */
  compact?: boolean
  className?: string
}

export function InspectionReport({
  site = 'refinery',
  finding,
  compact = false,
  className,
}: InspectionReportProps) {
  const f = finding ?? sampleFindings[site]
  const delta = f.reading - f.baseline
  return (
    <figure
      data-ui
      className={cn(
        '@container m-0 overflow-hidden rounded-media border border-line bg-surface-raised text-sm text-fg',
        className,
      )}
    >
      <figcaption className="sr-only">
        Sample Hoverline finding: {f.asset}, {f.location}, {formatReading(f.reading, f.unit)},{' '}
        {severityLabel[f.severity].toLowerCase()} severity, work order {f.workOrder.id}.
      </figcaption>

      {/* App bar: product, scope, flight */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <RouteGlyph className="h-3.5 w-5 shrink-0 text-accent" />
          <span className="truncate font-semibold">{f.siteName}</span>
          <span className="text-fg-muted max-sm:hidden">/</span>
          <span className="truncate text-fg-muted max-sm:hidden">Findings</span>
        </div>
        <span className="shrink-0 text-xs text-fg-muted">{f.flight}</span>
      </div>

      <div className="grid gap-0 @[34rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Capture */}
        <div className="border-line p-3 @[34rem]:border-r">
          <div className="overflow-hidden rounded-[6px] bg-thermal-0">
            <ThermalCrop finding={f} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-xs text-fg-muted">
            <span>
              {f.kind === 'thermal'
                ? 'Radiometric, 640\u00a0×\u00a0512'
                : 'Change since last survey'}
            </span>
            <span className="whitespace-nowrap">{f.capturedAt}</span>
          </div>
        </div>

        {/* Finding */}
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold">{f.asset}</p>
              <p className="text-xs text-fg-muted">{f.location}</p>
            </div>
            <span
              className={cn(
                'inline-flex h-6 shrink-0 items-center rounded-[4px] px-2 text-xs font-semibold whitespace-nowrap',
                severityChip[f.severity],
              )}
            >
              {severityLabel[f.severity]}
            </span>
          </div>

          <div>
            <p className="text-xs text-fg-muted">
              {f.kind === 'thermal' ? 'Max temperature' : 'Crest movement'}
            </p>
            <p className="text-[1.75rem] leading-tight font-semibold">
              {formatReading(f.reading, f.unit)}
            </p>
            {f.kind === 'thermal' ? (
              <div className="mt-2">
                <RampSwatch value={f.reading} />
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-fg-muted">
              Baseline
              <span className="block text-xs">{f.baselineNote}</span>
            </dt>
            <dd className="text-right">{formatReading(f.baseline, f.unit)}</dd>
            <dt className="text-fg-muted">Change</dt>
            <dd className="text-right font-semibold text-danger">{formatDelta(delta, f.unit)}</dd>
          </dl>

          <div className="rounded-[6px] border border-line bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{f.workOrder.id}</span>
              <span className="text-xs text-fg-muted">{f.workOrder.status}</span>
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">
              {f.workOrder.team}, {f.workOrder.due.toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      {compact ? null : (
        <div className="border-t border-line px-4 py-2">
          <p className="py-1 text-xs text-fg-muted">
            {f.others.length + 1} findings on this flight
          </p>
          <ul>
            {f.others.map((o) => (
              <li
                key={o.asset}
                className="flex items-center justify-between gap-3 border-t border-line/60 py-2 first:border-t-0"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{o.asset}</span>
                  <span className="text-fg-muted">
                    , {o.note.charAt(0).toLowerCase() + o.note.slice(1)}
                  </span>
                </span>
                <span
                  className={cn(
                    'inline-flex h-5 shrink-0 items-center rounded-[4px] px-1.5 text-[11px] font-semibold',
                    severityChip[o.severity],
                  )}
                >
                  {severityLabel[o.severity]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  )
}
