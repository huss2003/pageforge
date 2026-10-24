import type { Meta, StoryObj } from '@storybook/react-vite'
import { ComparisonTable } from '../blocks/comparison-table'
import { comparisonTable } from '../blocks/examples'

const meta = {
  title: 'Blocks/Comparison table',
  component: ComparisonTable,
} satisfies Meta<typeof ComparisonTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: comparisonTable }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: comparisonTable,
  globals: { theme: 'dark' },
}
