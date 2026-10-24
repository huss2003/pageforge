import type { Meta, StoryObj } from '@storybook/react-vite'
import { CaseStudy } from '../blocks/case-study'
import { caseStudy } from '../blocks/examples'

const meta = {
  title: 'Blocks/Case study',
  component: CaseStudy,
} satisfies Meta<typeof CaseStudy>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: caseStudy }

export const DefaultDark: Story = {
  name: 'Default (dark)',
  args: caseStudy,
  globals: { theme: 'dark' },
}
