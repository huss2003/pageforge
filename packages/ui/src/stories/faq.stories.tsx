import type { Meta, StoryObj } from '@storybook/react-vite'
import { Faq } from '../blocks/faq'
import { faq } from '../blocks/examples'

const meta = {
  title: 'Blocks/FAQ',
  component: Faq,
} satisfies Meta<typeof Faq>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: faq }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: faq,
  globals: { theme: 'dark' },
}
