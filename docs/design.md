# Hoverline design notes

## Concept

Hoverline sells drone inspection to operations and safety leaders at refineries, power utilities and mines. Their working documents are site plans, survey sheets and flight routes, so the brand borrows from **aeronautical survey charts** rather than generic SaaS styling.

## Color

| Token          | Hex       | Role                                            |
| -------------- | --------- | ----------------------------------------------- |
| `paper`        | `#EDF0EC` | Base surface (light)                            |
| `paper-raised` | `#F7F8F5` | Raised panels, media frames                     |
| `ink`          | `#14233A` | Text and structure lines                        |
| `ink-muted`    | `#4A5768` | Secondary text                                  |
| `rule`         | `#C9CFC8` | Borders and dividers                            |
| `route`        | `#B4246B` | The only accent: routes, primary actions, focus |
| `contour`      | `#7C8A6E` | Terrain lines, quiet data                       |
| `signal`       | `#D99A1E` | Inspection findings and warnings only           |
| `night`        | `#0F1B2B` | Base surface (dark)                             |

Magenta is the colour of flight routes on aviation charts. It is used sparingly so that wherever it appears, it reads as "the path" or "the action".

Components use the semantic tokens (`surface`, `fg`, `fg-muted`, `line`, `accent`), which switch automatically in dark mode. Illustrations may use the raw palette when they need fixed colours.

## Type

- **Archivo**, one family, variable width axis.
- Headlines: 125% width (expanded), bold — like airfield and equipment signage.
- Body: 100% width, regular, 17px base, 1.6 line height, measure under 70ch.
- Numbers: tabular figures everywhere, so readings and stats align without a monospace face.
- Scale: major third (1.25).

## Shape and space

- Radii carry hierarchy: controls 3px, media frames 10px.
- Structure comes from 1px rules and left-border accents, not shadows or card grids.
- Layout is left-aligned on a max 6xl container with 16px mobile gutters.

## Motion

One orchestrated moment per page: the hero route draws itself, waypoints appear in order, then the finding marker lands. Nothing else animates on its own. Reduced-motion users see the final state.

## Rules the AI writer follows

- One accent per block, and it is always magenta.
- Amber appears only next to a real finding.
- No all-caps labels, no eyebrow text above headings, no decorative numbering unless the content is a sequence.
