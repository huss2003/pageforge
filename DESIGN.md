---
version: alpha
name: Hoverline
description: Marketing site for Hoverline, a fictional drone-inspection company for refineries, power substations and open-pit mines. It should read like the survey sheet a site engineer already trusts, not like a software template.
colors:
  ground: '#EDF0EC' # paper: the dominant surface
  ground-raised: '#F7F8F5' # plans, forms, product fragments
  ground-shade: '#E3E8E1' # one tone step down: section field
  ink: '#14233A' # text and structure, 13.7:1 on ground
  muted: '#4A5768' # secondary text, 6.4:1 on ground, 5.9:1 on shade
  route: '#B4246B' # the one accent: routes, primary action, focus
  contour: '#7C8A6E' # terrain lines in drawings; never text
  signal: '#D99A1E' # inspection findings only, always with an ink ring
  signal-ink: '#7A4E00' # text on the signal wash, 5.7:1
  danger: '#A1262B' # form errors and adverse deltas, 6.5:1 on ground
  night: '#0F1B2B' # dark ground
  night-ink: '#E4E8E2' # dark text, 14.0:1 on night
  night-route: '#E66AA6' # dark accent, 5.8:1 on night
typography:
  display:
    fontFamily: Archivo
    fontWidth: 125%
    fontSize: clamp(2.25rem, 1rem + 4.4vw, 5rem)
    fontWeight: 700
    letterSpacing: -0.03em
    lineHeight: 0.98
  heading:
    fontFamily: Archivo
    fontWidth: 125%
    fontSize: clamp(2rem, 1.35rem + 2.1vw, 3.375rem)
    fontWeight: 700
    letterSpacing: -0.02em
    lineHeight: 1.04
  title:
    fontFamily: Archivo
    fontWidth: 112%
    fontSize: 1.625rem
    fontWeight: 600
  body:
    fontFamily: Archivo
    fontWidth: 100%
    fontSize: 1.0625rem
    lineHeight: 1.6
    fontVariantNumeric: tabular-nums
rounded:
  control: 3px
  media: 10px
spacing:
  gutter: clamp(1rem, 3vw, 2.5rem)
  section: 5rem / 6rem / 7rem # phone / tablet / desktop, top and bottom
  page: 86rem # frame cap
components:
  button-primary:
    backgroundColor: '{colors.route}'
    textColor: '#FFFFFF'
    rounded: '{rounded.control}'
    height: 48px
  button-secondary:
    borderColor: '{colors.ink}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
---

# Hoverline design contract

Every page, block and fragment reads this file first. If a value you need is
not here, add it here (and to `packages/ui/src/theme.css` and `tokens.ts`)
before using it. Never invent a one-off inside a component.

## The idea

> On this page, **the inspection route drawn over a survey sheet of the
> visitor's own kind of site** becomes **the hero, the section rhythm and
> every proof device**.

Hoverline's customers already live with site plans, flight routes, permit
drawings and thermal readings. The page uses those artefacts as its
material: the hero is a working site plan you can switch between a
refinery, a substation and an open pit; steps are waypoints on a route;
case studies carry the operator's plan with the route as flown; findings
are amber markers with an ink ring, exactly as on the plans; the product
appears as a real slice of the app (a finding card with a thermal crop and
a work order), never as a stock dashboard. The competitor test: put a
generic SaaS name on it and the plans, routes and findings stop making
sense, so the idea belongs to this subject.

**The live thing** is the `RoutePlanner`. A visitor picks a site type and
the plan redraws with that site's structures, the magenta route draws
itself once, the waypoints land in order, the amber findings appear, and a
readout gives route length, flight time and assets covered.

## Overview

Audience: operations, reliability and safety leads at refineries, power
utilities and mines, plus the planners and IT people they bring in. They
are sceptical of drones-as-marketing and fluent in drawings. The look comes
from **aeronautical survey charts and site plans**: chart paper, navy ink,
a magenta route (the colour aviation charts use for routes), sage terrain
contours, edge ticks, coordinates in the sheet corners, a north arrow and a
scale bar. One typeface, Archivo, set expanded for headings like airfield
signage and plain for reading.

## Colors

Semantic tokens switch with the theme; use them in components. Raw palette
tokens stay fixed for drawings that must not change.

| Token (utility)              | Light                 | Dark                  | Job                                             |
| ---------------------------- | --------------------- | --------------------- | ----------------------------------------------- |
| `surface` (`bg-surface`)     | `#EDF0EC`             | `#0F1B2B`             | Page ground                                     |
| `surface-raised`             | `#F7F8F5`             | `#16263A`             | Plans, forms, the product fragment              |
| `surface-shade`              | `#E3E8E1`             | `#132339`             | The shade field; segmented control track        |
| `fg`                         | `#14233A`             | `#E4E8E2`             | All running text and headings (13.7:1 / 14.0:1) |
| `fg-muted`                   | `#4A5768`             | `#A7B0B8`             | Notes, sources, labels (6.4:1 / 7.9:1)          |
| `line`                       | `#C9CFC8`             | `#2B3B50`             | Rules in tables, lists and frames (non-text)    |
| `control`                    | `#6B7570`             | `#7D8DA3`             | Form control borders, 4.5:1 on raised           |
| `accent`                     | `#B4246B`             | `#E66AA6`             | Route, primary button, focus ring, current nav  |
| `accent-strong`              | `#8E1A53`             | `#F08DBD`             | Primary hover                                   |
| `accent-fg`                  | `#FFFFFF`             | `#0F1B2B`             | Text on accent (6.2:1 / 5.8:1)                  |
| `signal` (raw)               | `#D99A1E`             | same                  | Finding markers only, always with an `fg` ring  |
| `signal-ink` / `signal-wash` | `#7A4E00` / `#F3E4C0` | `#F0C060` / `#3A2E12` | The "High" severity chip                        |
| `danger`                     | `#A1262B`             | `#F28B82`             | Form errors, an adverse change in a reading     |
| `contour` (raw)              | `#7C8A6E`             | same                  | Terrain lines, hatching. Not text (3.2:1)       |

**Fields.** A section can change the whole ground: `paper` (default),
`shade` (`.hl-field-shade`) or `ink` (`.hl-field-ink`: navy ground, paper
text, the dark accent). Sections are told apart by these fields and by
space, never by dividers or cards. `BlockRenderer` makes sure two tinted
fields never touch (`resolveFields`).

**Proportion.** Paper 70–85 % of a screen; ink as text and one or two ink
fields per page; magenta under 5 % (the route, one primary button per
screen, the focus ring). Amber only next to a real finding.

**Thermal ramp** (product readings only): `thermal-0` `#14233A` →
`thermal-1` `#34506C` → `thermal-2` `#7D6A4A` → `thermal-3` `#C4861C` →
`thermal-4` `#EFC35A` → `thermal-5` `#FFF4D6`. Six flat steps from navy to
near-white through amber, so a hot spot reads as "toward the finding
colour" and the scale stays inside the palette. Shown as quantised cells,
never as a gradient.

### Changes from the M0 palette (and why)

- **Added** `paper-shade` `#E3E8E1` and its dark twin `#132339`: section
  fields need a tone step; borders and shadows are not used for that.
- **Added** `control` `#6B7570` / `#7D8DA3`: form borders must reach 3:1+
  against the field (they reach 4.5:1); `rule` is too faint for inputs.
- **Added** `signal-ink` / `signal-wash` and `danger`: amber at `#D99A1E`
  is 2.1:1 on paper, so it can never be text. Text about a finding uses
  `signal-ink` on the wash (5.7:1); errors use `danger`.
- **Changed** `night-route` `#E0569A` → `#E66AA6`: dark-mode buttons and
  links needed more than 4.92:1 against night and the ink field
  (`#E66AA6`: 5.8:1 on night, 4.6:1 on the dark ink field), and navy text
  on the button rises from 4.9:1 to 5.8:1.
- **Changed** dark `accent-strong` `#F07AB2` → `#F08DBD` so hover raises
  contrast instead of lowering it.
- **Added** the thermal ramp (above) and `ink-raised` `#1B2E47` for the
  ink field's raised surfaces.
- **Changed** the type scale (below): the old 1.25 ratio produced nine
  close sizes; the new scale has five working sizes far apart.

## Typography

One family, Archivo (variable, width 62–125, weight 100–900), loaded by
`next/font` in the app (`--font-archivo`) and by a Google Fonts link in
Storybook. Tabular figures everywhere.

| Step         | Size               | Width | Weight  | Role                                          |
| ------------ | ------------------ | ----- | ------- | --------------------------------------------- |
| `display`    | clamp(36px → 80px) | 125 % | 700     | Hero `h1`, one per page; the lead stat        |
| `display-sm` | clamp(34px → 64px) | 125 % | 700     | Hero `h1` when the copy is longer             |
| `heading`    | clamp(32px → 54px) | 125 % | 700     | Section `h2`; metric read-outs                |
| `heading-sm` | clamp(28px → 42px) | 125 % | 700     | Section `h2` when the copy is long            |
| `title`      | 26px               | 112 % | 600     | Item titles (`h3`): steps, tabs, form states  |
| `lead`       | 21px / 1.45        | 100 % | 400     | Supporting sentence under a heading           |
| `base`       | 17px / 1.6         | 100 % | 400     | Running text, always full ink                 |
| `sm` / `xs`  | 15px / 13px        | 100 % | 400–600 | Sources, captions, labels, never tracked caps |

- **Headings size themselves from their copy.** The writer agent controls
  heading length (up to 90 characters), so `heroHeadingClass` and
  `SectionHeading` pick the largest step that keeps the heading to two
  lines in its column (Archivo 125 % bold ≈ 0.61 em per character).
- Display tracking −0.03 em, heading −0.02 em; `text-wrap: balance` on all
  headings, `pretty` on paragraphs; paragraphs capped at 66 ch.
- Headings are ink. No accented word, no italics, no gradient, no eyebrow.

## Layout

- **Frame:** one pair of equal margins (`--gutter`: 16 px phone → 40 px
  desktop) and an 86 rem cap (`Container`). Chrome sits on the same frame.
- **Grid:** 12 columns expressed as ratios. Two anchor lines carry the
  page: the left margin, and the 5/12 line where the second column of most
  splits begins.
- **Section rhythm (`Section rhythm`):** `default` 80 / 96 / 112 px top and
  bottom (phone / tablet / desktop), so neighbours sit 160–224 px apart on
  desktop; `tight` 40–56 px for the operator band; `hero` for the first
  screen. A change of field lets the gap read smaller.
- **Compositions** (no two neighbours alike in the example page):
  hero = full-width headline over copy + live plan; operators = name board;
  feature grid = heading + product fragment, then a ruled datasheet; use
  cases = tabs over story + plan crop; how it works = waypoints on a route;
  stats = instrument read-outs on ink; case study = plan + account;
  comparison = real table with the Hoverline column filled; testimonial =
  the one centred moment, on ink; integrations = index; compliance =
  drawing stamps; FAQ = sticky heading + disclosures; demo form = promise
  as a route + form; CTA band = action on ink over the route strip.
- **Phone** is its own composition: tables become per-row lists, the route
  in "How it works" runs down the left edge, plan labels hide below `sm`
  and their content moves to the readout below the plan.

## Elevation & depth

Flat. Surfaces separate by a tone step (`surface` → `surface-raised`) plus
a 1 px `line` border on media frames only. No shadows on anything at rest.
The one shadow-like device is the inset outline on the selected segment.

## Shapes

- Controls (buttons, inputs, segmented options, chips): **3 px**.
- Media frames (plans, the product fragment, the form panel): **10 px**.
- Inside the product fragment, app conventions apply (4–6 px).
- Plan language: dock = filled square; waypoint = hollow ring in route
  colour; finding = amber disc with an ink ring and a soft amber halo;
  structures = ink outlines on raised fill; terrain = sage lines.

## Components

All in `packages/ui`. Server components unless marked client.

- **Container, Section, Heading, Text** (`primitives/layout.tsx`).
- **ButtonLink / Button** (`primitives/button.tsx`): `primary` magenta, one
  per screen; `secondary` ink outline; `quiet` underlined text link. Labels
  say what happens. No arrow glyphs.
- **Field, Input, Select, Textarea** (`primitives/field.tsx`): label above,
  48 px controls, error under the field in `danger`, wired with
  `aria-describedby` / `aria-invalid`.
- **Disclosure** (`primitives/disclosure.tsx`): native `<details>`, grouped
  with `name` so one opens at a time; the plus turns to a cross.
- **Glyphs** (`primitives/glyphs.tsx`): the few marks the system needs,
  drawn for it: route mark, check, dash, plus, menu, close, waypoint,
  finding, dock. No icon library.
- **SiteHeader**: wordmark + route mark, up to five links, one action.
  Below `lg` the links move into a `<details>` sheet that works without JS.
  Skip link included. Pass `currentPath` to mark the current link.
- **SiteFooter**: ink field, wordmark, the fictional-company disclosure at
  lead size in full ink, nav, "Built with PageForge, source on GitHub",
  and the route landing back at its dock.
- **RoutePlanner** (`route-planner.tsx`): the signature element. Native
  radios + CSS (`.hl-switch`), so it is server-rendered, works with no JS,
  gets arrow-key behaviour from the browser, and redraws its route each
  time a plan is shown.
- **SitePlan / RouteStrip** (`illustrations/`): the three plans (refinery,
  substation, open pit) and the route unrolled into a strip.
- **InspectionReport** (`inspection-report.tsx`): one finding as the app
  shows it, built under `data-ui` with app-screen rules; responsive to its
  own width via a container query.
- **14 blocks** (`blocks/*.tsx`) and **BlockRenderer** (`blocks/index.tsx`).

## Motion

One orchestrated moment per page: the hero route draws itself (2.2 s,
in-out), each waypoint lands as the line reaches it, then the findings
appear (0.4 s ease-out each, 180 ms apart). Switching the planner's site
replays it for the new plan, because the visitor asked. Elsewhere only
feedback: 150–180 ms colour changes on hover, a 1 px press on buttons, the
disclosure cross turning. No fade-up on sections, no count-ups, no loops.
`prefers-reduced-motion: reduce` shows the finished state with no
animation. Transform, opacity and stroke-dashoffset only.

## Imagery

No stock photography and no fake product shots. Pictures are drawn from
the subject: site plans with real structure (tank farm with bund and
floating-roof tanks, pipe rack with bents, process units, flare exclusion
zone; substation gantry, busbars, six bays with disconnects and breakers,
three transformers with radiators; open pit with seven benched rings,
spiral haul road, sump, waste dump and crusher), routes over them, and a
radiometric crop in the product fragment. A strong next step, if real
pictures are wanted, is archival aerial survey photography or USGS
orthoimagery credited in the footer; none is presented as Hoverline's.

## Do's and Don'ts

- Do reuse the header, footer, tokens and blocks above on every page.
- Do add a token here before a page uses it.
- Do keep amber for findings and magenta for the route and the action.
- Don't change: Archivo; the paper / ink / route / contour / signal roles.
- Don't use: purple or indigo; gradients (text, buttons, grounds); cream
  with terracotta; near-black with acid green; all-caps eyebrows above
  headings; one accented word in a headline; decorative 01 / 02 / 03 (only
  `howItWorks` and the demo form's next steps are numbered or routed,
  because they are sequences); the identical rounded-card grid with soft
  grey shadows; icons in tinted squares; arrows appended to CTA text;
  monospace labels; middle-dot meta strings; fade-up on every section;
  stock icon libraries; untouched component-kit looks.
