import type { Meta, StoryObj } from '@storybook/react-vite'
import { SiteFooter, SiteHeader } from '../chrome'

const nav = [
  { label: 'Platform', href: '/platform' },
  { label: 'Refineries', href: '/refineries' },
  { label: 'Utilities', href: '/utilities' },
  { label: 'Mining', href: '/mining' },
  { label: 'Case studies', href: '/case-studies' },
]
const cta = { label: 'Book a site walk-through', href: '#demo' }
const disclosure =
  'Hoverline is a fictional company. This site is a portfolio project built with PageForge.'

function Chrome() {
  return (
    <div className="flex min-h-[640px] flex-col">
      <SiteHeader nav={nav} cta={cta} currentPath="/refineries" />
      <main id="main" className="flex-1" />
      <SiteFooter disclosure={disclosure} nav={[...nav, { label: 'Privacy', href: '/privacy' }]} />
    </div>
  )
}

const meta = {
  title: 'Chrome/Header and footer',
  component: Chrome,
} satisfies Meta<typeof Chrome>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Dark: Story = { globals: { theme: 'dark' } }
