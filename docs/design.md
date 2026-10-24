# Hoverline design notes

The design contract moved to [`DESIGN.md`](../DESIGN.md) at the repo root. It
holds the tokens, type scale, layout grid, section rhythm, component rules,
motion and imagery approach, and the changes made to the M0 palette.

Short version, for the AI writer:

- The concept is an **aeronautical survey chart**: paper, navy ink, a magenta
  flight route as the only accent, sage contours, amber only for findings.
- One typeface, Archivo: expanded bold for headings, normal width for text,
  tabular figures everywhere.
- Headings should be short (about 30–50 characters); the components size them
  to stay on two lines, but shorter copy sets larger.
- One accent per block, and it is always magenta. Amber appears only next to a
  real finding.
- No all-caps labels, no eyebrow text above headings, no decorative numbering
  unless the content is a sequence.

Browse every block, light and dark, in Storybook:
`pnpm --filter @pageforge/ui storybook`.
