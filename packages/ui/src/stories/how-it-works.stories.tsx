import type { Meta, StoryObj } from '@storybook/react-vite'
import { HowItWorks } from '../blocks/how-it-works'
import { howItWorks } from '../blocks/examples'

const meta = {
  title: 'Blocks/How it works',
  component: HowItWorks,
} satisfies Meta<typeof HowItWorks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: howItWorks }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: howItWorks,
  globals: { theme: 'dark' },
}
