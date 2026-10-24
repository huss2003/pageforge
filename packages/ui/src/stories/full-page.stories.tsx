import type { Meta, StoryObj } from '@storybook/react-vite'
import { SiteFooter, SiteHeader } from '../chrome'
import { BlockRenderer } from '../blocks'
import { examplePage } from '../blocks/examples'
import type { DemoFormState } from '../blocks/types'

async function action(): Promise<DemoFormState> {
  await new Promise((r) => setTimeout(r, 600))
  return { status: 'success' }
}

const nav = [
  { label: 'Platform', href: '#platform' },
  { label: 'Sites', href: '#sites' },
  { label: 'Case studies', href: '#case-sabine-crest' },
  { label: 'Questions', href: '#faq' },
]

function FullPage({ preview = false }: { preview?: boolean }) {
  return (
    <>
      <SiteHeader nav={nav} cta={{ label: 'Book a site walk-through', href: '#demo' }} />
      <main id="main">
        <BlockRenderer blocks={examplePage} context={{ preview, demoFormAction: action }} />
      </main>
      <SiteFooter
        disclosure="Hoverline is a fictional company. This site is a portfolio project built with PageForge."
        nav={nav}
      />
    </>
  )
}

const meta = {
  title: 'Pages/Full page',
  component: FullPage,
} satisfies Meta<typeof FullPage>

export default meta
type Story = StoryObj<typeof meta>

export const Home: Story = {}
export const HomeDark: Story = { name: 'Home (dark)', globals: { theme: 'dark' } }
export const Preview: Story = { name: 'Home (preview mode)', args: { preview: true } }
