import type { Meta, StoryObj } from '@storybook/react-vite'
import { Integrations } from '../blocks/integrations'
import { integrations } from '../blocks/examples'

const meta = {
  title: 'Blocks/Integrations',
  component: Integrations,
} satisfies Meta<typeof Integrations>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: integrations }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: integrations,
  globals: { theme: 'dark' },
}
