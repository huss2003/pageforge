import type { Block, Page } from '@pageforge/blocks'
import { facts } from '@pageforge/content'
import { getAllPublicPages } from '@/lib/content'
import { pathForPage } from '@/lib/paths'
import { absoluteUrl, repoUrl, site } from '@/lib/site'

/**
 * /llms.txt (llmstxt.org): a plain summary of the site for AI crawlers and
 * assistants, built from the same content as the pages.
 */
export const dynamic = 'force-static'

const firstHero = (page: Page) =>
  page.blocks.find((b): b is Extract<Block, { _type: 'hero' }> => b._type === 'hero')

const line = (page: Page) =>
  `- [${page.title}](${absoluteUrl(pathForPage(page))}): ${page.seo.description}`

export async function GET() {
  const pages = await getAllPublicPages()
  const of = (kind: Page['kind']) => pages.filter((p) => p.kind === kind)
  const home = of('home')[0]

  const body = [
    `# ${site.name}`,
    '',
    `> ${facts.company.oneLiner}`,
    '',
    `Important: ${facts.company.disclosure} Every operator, person and number on this site is invented for the demo. Source: ${repoUrl}`,
    '',
    home ? (firstHero(home)?.subheading ?? '') : '',
    '',
    '## Pages',
    '',
    ...[...of('home'), ...of('platform'), ...of('page')].map(line),
    '',
    '## Industries',
    '',
    ...of('industry').map(line),
    '',
    '## Case studies',
    '',
    ...of('caseStudy').map(line),
    '',
    '## Key facts',
    '',
    ...facts.stats.map((s) => `- ${s.value}${s.unit ? ` ${s.unit}` : ''} ${s.label} (${s.basis})`),
    ...facts.specs.slice(0, 8).map((s) => `- ${s.label}: ${s.value}`),
    '',
    '## Optional',
    '',
    `- [Sitemap](${absoluteUrl('/sitemap.xml')})`,
    `- [Source code](${repoUrl})`,
    '',
  ].join('\n')

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
