import type { Meta, StoryObj } from '@storybook/react-vite'
import { InspectionReport } from '../inspection-report'
import { RouteStrip } from '../illustrations/route-strip'
import { SitePlan } from '../illustrations/site-plans'
import { Container } from '../primitives/layout'
import { RoutePlanner } from '../route-planner'

const meta = {
  title: 'Signature/Route planner',
  component: RoutePlanner,
  decorators: [
    (Story) => (
      <Container className="py-10">
        <div className="mx-auto max-w-5xl">
          <Story />
        </div>
      </Container>
    ),
  ],
} satisfies Meta<typeof RoutePlanner>

export default meta
type Story = StoryObj<typeof meta>

export const Refinery: Story = { args: { defaultSite: 'refinery' } }
export const Substation: Story = { args: { defaultSite: 'substation' } }
export const OpenPit: Story = { name: 'Open-pit mine', args: { defaultSite: 'open-pit' } }

export const Dark: Story = {
  args: { defaultSite: 'refinery' },
  globals: { theme: 'dark' },
}

export const WithBrandFacts: Story = {
  name: 'With route facts from brand facts',
  args: {
    defaultSite: 'substation',
    routeFacts: {
      substation: [
        { label: 'Route length', value: '2.7 km' },
        { label: 'Flight time', value: '15 min' },
        { label: 'Bays covered', value: '6' },
        { label: 'Phases read', value: '54' },
      ],
    },
  },
}

export const Static: Story = {
  name: 'Static (no animation)',
  args: { defaultSite: 'open-pit', animate: false },
}

export const PlansSideBySide: StoryObj = {
  name: 'All three plans',
  render: () => (
    <div className="grid gap-6 lg:grid-cols-3">
      {(['refinery', 'substation', 'open-pit'] as const).map((s) => (
        <div key={s} className="rounded-media border border-line bg-surface-raised p-3">
          <SitePlan site={s} idPrefix={`side-${s}`} animate={false} />
        </div>
      ))}
    </div>
  ),
}

export const Strip: StoryObj = {
  name: 'Route strip',
  render: () => (
    <div className="flex flex-col gap-10">
      <RouteStrip site="refinery" animate />
      <RouteStrip site="substation" />
      <RouteStrip site="open-pit" />
    </div>
  ),
}

export const Report: StoryObj = {
  name: 'Inspection report',
  render: () => (
    <div className="grid gap-8 lg:grid-cols-2">
      <InspectionReport site="refinery" />
      <InspectionReport site="open-pit" />
    </div>
  ),
}

export const ReportDark: StoryObj = {
  name: 'Inspection report (dark)',
  render: () => (
    <div className="grid gap-8 lg:grid-cols-2">
      <InspectionReport site="substation" />
      <InspectionReport site="refinery" compact />
    </div>
  ),
  globals: { theme: 'dark' },
}
