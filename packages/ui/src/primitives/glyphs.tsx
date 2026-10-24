import type { SVGProps } from 'react'

/**
 * The handful of glyphs Hoverline needs, drawn for it. Stroke weights match
 * the site plans (1.5px at 16px), corners are square, and every glyph is
 * decorative unless a label is passed.
 */
type GlyphProps = SVGProps<SVGSVGElement> & { label?: string }

function Svg({ label, children, ...props }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Wordmark glyph: a closed survey route with its dock and one waypoint. */
export function RouteGlyph(props: GlyphProps) {
  return (
    <svg
      viewBox="0 0 28 20"
      width="28"
      height="20"
      fill="none"
      aria-hidden={props.label ? undefined : true}
      {...props}
    >
      <path
        d="M3 16 L6 5 L15 2.5 L24 6 L22.5 15.5 L12 17.5 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="1" y="14" width="4.5" height="4.5" fill="currentColor" />
      <circle
        cx="15"
        cy="2.5"
        r="2.25"
        fill="var(--surface)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function CheckGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 8.5 L6.25 12 L13.5 4" strokeLinecap="square" />
    </Svg>
  )
}

export function DashGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M4 8 H12" />
    </Svg>
  )
}

export function PlusGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M8 2.5 V13.5 M2.5 8 H13.5" />
    </Svg>
  )
}

/** Menu: three survey ticks of different lengths rather than a stock hamburger. */
export function MenuGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M2 4 H14 M2 8 H11 M2 12 H14" />
    </Svg>
  )
}

export function CloseGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3 3 L13 13 M13 3 L3 13" />
    </Svg>
  )
}

/** Waypoint: hollow ring, the marker used on every route. */
export function WaypointGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="4.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
    </Svg>
  )
}

/** Finding: amber disc with an ink ring, the only amber mark in the system. */
export function FindingGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle
        cx="8"
        cy="8"
        r="5"
        fill="var(--color-signal)"
        stroke="var(--fg)"
        strokeWidth="1.25"
      />
    </Svg>
  )
}

/** Dock: the filled square the route starts and ends at. */
export function DockGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="9" height="9" fill="currentColor" stroke="none" />
    </Svg>
  )
}
