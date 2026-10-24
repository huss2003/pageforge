/**
 * Hoverline design tokens — the single source of truth for values that code
 * (not CSS) needs: OG image generation, charts, the AI planner's style notes,
 * the thermal crop in InspectionReport. Keep in sync with theme.css and
 * DESIGN.md.
 *
 * Concept: an aeronautical survey chart. Paper, ink, a magenta flight route,
 * sage contour lines, and amber reserved for findings that need attention.
 */
export const tokens = {
  color: {
    paper: '#EDF0EC',
    paperRaised: '#F7F8F5',
    paperShade: '#E3E8E1',
    ink: '#14233A',
    inkMuted: '#4A5768',
    inkRaised: '#1B2E47',
    rule: '#C9CFC8',
    control: '#6B7570',
    route: '#B4246B',
    routeStrong: '#8E1A53',
    contour: '#7C8A6E',
    signal: '#D99A1E',
    signalInk: '#7A4E00',
    signalWash: '#F3E4C0',
    danger: '#A1262B',
    night: '#0F1B2B',
    nightRaised: '#16263A',
    nightShade: '#132339',
    nightInk: '#E4E8E2',
    nightMuted: '#A7B0B8',
    nightRoute: '#E66AA6',
    /** Thermal ramp, cold to hot. Heat readings in product UI only. */
    thermal0: '#14233A',
    thermal1: '#34506C',
    thermal2: '#7D6A4A',
    thermal3: '#C4861C',
    thermal4: '#EFC35A',
    thermal5: '#FFF4D6',
  },
  font: {
    family: 'Archivo',
    /** Archivo width axis: 125 = expanded display, 100 = text. */
    displayWidth: 125,
    textWidth: 100,
  },
  /** Type scale in px at desktop (display and heading are fluid in CSS). */
  type: {
    xs: 13,
    sm: 15,
    base: 17,
    lead: 21,
    title: 26,
    heading: 54,
    display: 80,
  },
  radius: {
    control: '3px',
    media: '10px',
  },
  motion: {
    routeDrawSeconds: 2.2,
    easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
} as const

export type TokenColor = keyof typeof tokens.color
