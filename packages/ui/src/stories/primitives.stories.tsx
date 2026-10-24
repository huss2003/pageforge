import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button, ButtonLink } from '../primitives/button'
import { Disclosure } from '../primitives/disclosure'
import { Field, Input, Select, Textarea } from '../primitives/field'
import {
  CheckGlyph,
  DockGlyph,
  FindingGlyph,
  RouteGlyph,
  WaypointGlyph,
} from '../primitives/glyphs'
import { Container, Heading, Section, Text } from '../primitives/layout'
import { tokens } from '../tokens'

function Swatch({ name, value, note }: { name: string; value: string; note: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="size-10 shrink-0 rounded-control border border-line"
        style={{ background: value }}
      />
      <span className="text-sm">
        <span className="block font-semibold text-fg">{name}</span>
        <span className="block text-fg-muted">
          {value}, {note}
        </span>
      </span>
    </div>
  )
}

function Primitives() {
  const c = tokens.color
  return (
    <>
      <Section rhythm="tight">
        <Container>
          <Heading as="h1" size="display">
            Hoverline design system
          </Heading>
          <Text size="lead" className="mt-6">
            An aeronautical survey chart: paper and ink, a magenta flight route as the only accent,
            sage contours for terrain, amber only where a flight found something.
          </Text>
        </Container>
      </Section>

      <Section rhythm="tight">
        <Container>
          <Heading size="title">Colour</Heading>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Swatch name="Paper" value={c.paper} note="ground" />
            <Swatch name="Ink" value={c.ink} note="text, 13.7:1" />
            <Swatch name="Route" value={c.route} note="the one accent" />
            <Swatch name="Contour" value={c.contour} note="terrain lines" />
            <Swatch name="Signal" value={c.signal} note="findings only" />
            <Swatch name="Paper shade" value={c.paperShade} note="section field" />
            <Swatch name="Ink field" value={c.ink} note="section field" />
            <Swatch name="Night" value={c.night} note="dark ground" />
          </div>
          <div className="mt-8 flex h-8 max-w-md overflow-hidden rounded-control">
            {[c.thermal0, c.thermal1, c.thermal2, c.thermal3, c.thermal4, c.thermal5].map((t) => (
              <span key={t} className="flex-1" style={{ background: t }} />
            ))}
          </div>
          <p className="mt-2 text-sm text-fg-muted">Thermal ramp, product readings only</p>
        </Container>
      </Section>

      <Section rhythm="tight">
        <Container>
          <Heading size="title">Type</Heading>
          <div className="mt-6 flex flex-col gap-6">
            <p className="text-display font-bold [font-stretch:125%]">Display 80</p>
            <p className="text-heading font-bold [font-stretch:125%]">Heading 54</p>
            <p className="text-title font-semibold [font-stretch:112%]">Title 26</p>
            <p className="text-lead">Lead 21: the supporting sentence under a heading.</p>
            <p className="text-base">
              Body 17: running text in full ink, under 66 characters a line.
            </p>
            <p className="text-sm text-fg-muted">Small 15 and xs 13: notes, sources, labels.</p>
          </div>
        </Container>
      </Section>

      <Section rhythm="tight" field="shade">
        <Container>
          <Heading size="title">Actions</Heading>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ButtonLink href="#">Book a site walk-through</ButtonLink>
            <ButtonLink href="#" variant="secondary">
              See a sample report
            </ButtonLink>
            <ButtonLink href="#" variant="quiet">
              Read the case study
            </ButtonLink>
            <Button size="md" disabled>
              Sending…
            </Button>
          </div>
        </Container>
      </Section>

      <Section rhythm="tight">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <Heading size="title">Fields</Heading>
            <div className="mt-6 grid gap-5">
              <Field id="p-name" label="Name">
                {(a) => <Input {...a} placeholder="Dana Reyes" />}
              </Field>
              <Field
                id="p-email"
                label="Work email"
                error="Enter a work email, like dana@operator.com."
              >
                {(a) => <Input {...a} defaultValue="dana@" />}
              </Field>
              <Field id="p-site" label="Site type">
                {(a) => (
                  <Select {...a} defaultValue="substation">
                    <option value="refinery">Refinery</option>
                    <option value="substation">Substation</option>
                  </Select>
                )}
              </Field>
              <Field id="p-msg" label="What should the drone look at?" optional>
                {(a) => <Textarea {...a} />}
              </Field>
            </div>
          </div>
          <div>
            <Heading size="title">Disclosure</Heading>
            <div className="mt-6 border-t border-line">
              <Disclosure summary="Who handles airspace approval?" name="p" defaultOpen>
                <p>We do, and a licensed remote pilot monitors every flight.</p>
              </Disclosure>
              <Disclosure summary="What happens in bad weather?" name="p">
                <p>The drone waits in the dock and makes up the missed shift.</p>
              </Disclosure>
            </div>
            <Heading size="title" className="mt-12">
              Glyphs
            </Heading>
            <div className="mt-6 flex items-center gap-6 text-fg">
              <RouteGlyph className="h-5 w-7 text-accent" label="Route" />
              <WaypointGlyph label="Waypoint" />
              <FindingGlyph label="Finding" />
              <DockGlyph label="Dock" />
              <CheckGlyph label="Yes" />
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}

const meta = {
  title: 'Primitives/Overview',
  component: Primitives,
} satisfies Meta<typeof Primitives>

export default meta
type Story = StoryObj<typeof meta>

export const Light: Story = {}
export const Dark: Story = { globals: { theme: 'dark' } }
