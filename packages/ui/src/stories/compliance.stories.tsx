import type { Meta, StoryObj } from '@storybook/react-vite'
import { Compliance } from '../blocks/compliance'
import { compliance } from '../blocks/examples'

const meta = {
  title: 'Blocks/Compliance',
  component: Compliance,
} satisfies Meta<typeof Compliance>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: compliance }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: compliance,
  globals: { theme: 'dark' },
}
