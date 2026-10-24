import type { Meta, StoryObj } from '@storybook/react-vite'
import { Hero } from '../blocks/hero'
import { heroRoute, heroSplit, heroStatement } from '../blocks/examples'

const meta = {
  title: 'Blocks/Hero',
  component: Hero,
} satisfies Meta<typeof Hero>

export default meta
type Story = StoryObj<typeof meta>

export const Route: Story = { args: heroRoute }

export const RouteDark: Story = {
  name: 'Route (dark)',
  args: heroRoute,
  globals: { theme: 'dark' },
}

export const Statement: Story = { args: heroStatement }

export const StatementDark: Story = {
  name: 'Statement (dark)',
  args: heroStatement,
  globals: { theme: 'dark' },
}

export const Split: Story = { args: heroSplit }

export const SplitDark: Story = {
  name: 'Split (dark)',
  args: heroSplit,
  globals: { theme: 'dark' },
}
