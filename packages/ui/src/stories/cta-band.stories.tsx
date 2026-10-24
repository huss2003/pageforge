import type { Meta, StoryObj } from '@storybook/react-vite'
import { CtaBand } from '../blocks/cta-band'
import { ctaBand } from '../blocks/examples'

const meta = {
  title: 'Blocks/CTA band',
  component: CtaBand,
} satisfies Meta<typeof CtaBand>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: ctaBand }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: ctaBand,
  globals: { theme: 'dark' },
}
