import type { Meta, StoryObj } from '@storybook/react-vite'
import { OperatorStrip } from '../blocks/operator-strip'
import { operatorStrip } from '../blocks/examples'

const meta = {
  title: 'Blocks/Operator strip',
  component: OperatorStrip,
} satisfies Meta<typeof OperatorStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: operatorStrip }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: operatorStrip,
  globals: { theme: 'dark' },
}
