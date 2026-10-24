/**
 * Hoverline design tokens — the single source of truth for values that code
 * (not CSS) needs: OG image generation, charts, the AI planner's style notes.
 * Keep in sync with theme.css.
 *
 * Concept: an aeronautical survey chart. Paper, ink, a magenta flight route,
 * sage contour lines, and amber reserved for findings that need attention.
 */
export const tokens = {
  color: {
    paper: '#EDF0EC',
    paperRaised: '#F7F8F5',
    ink: '#14233A',
    inkMuted: '#4A5768',
    rule: '#C9CFC8',
    route: '#B4246B',
    routeStrong: '#8E1A53',
    contour: '#7C8A6E',
    signal: '#D99A1E',
    night: '#0F1B2B',
    nightRaised: '#16263A',
    nightInk: '#E4E8E2',
    nightRoute: '#E0569A',
  },
  font: {
    family: 'Archivo',
    /** Archivo width axis: 125 = expanded display, 100 = text. */
    displayWidth: 125,
    textWidth: 100,
  },
  radius: {
    control: '3px',
    media: '10px',
  },
} as const

export type TokenColor = keyof typeof tokens.color
