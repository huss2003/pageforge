import type { Meta, StoryObj } from '@storybook/react-vite'
import { UseCaseTabs } from '../blocks/use-case-tabs'
import { useCaseTabs } from '../blocks/examples'

const meta = {
  title: 'Blocks/Use case tabs',
  component: UseCaseTabs,
} satisfies Meta<typeof UseCaseTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: useCaseTabs }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: useCaseTabs,
  globals: { theme: 'dark' },
}
