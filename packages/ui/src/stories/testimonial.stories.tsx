import type { Meta, StoryObj } from '@storybook/react-vite'
import { Testimonial } from '../blocks/testimonial'
import { testimonial } from '../blocks/examples'

const meta = {
  title: 'Blocks/Testimonial',
  component: Testimonial,
} satisfies Meta<typeof Testimonial>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: testimonial }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: testimonial,
  globals: { theme: 'dark' },
}
