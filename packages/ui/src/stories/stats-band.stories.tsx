import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatsBand } from '../blocks/stats-band'
import { statsBand } from '../blocks/examples'

const meta = {
  title: 'Blocks/Stats band',
  component: StatsBand,
} satisfies Meta<typeof StatsBand>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: statsBand }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: statsBand,
  globals: { theme: 'dark' },
}
