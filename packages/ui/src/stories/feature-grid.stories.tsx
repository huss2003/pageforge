import type { Meta, StoryObj } from '@storybook/react-vite'
import { FeatureGrid } from '../blocks/feature-grid'
import { featureGrid } from '../blocks/examples'

const meta = {
  title: 'Blocks/Feature grid',
  component: FeatureGrid,
} satisfies Meta<typeof FeatureGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: featureGrid }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: featureGrid,
  globals: { theme: 'dark' },
}
