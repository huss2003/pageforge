import type { BrandFacts } from './types'

// PLACEHOLDER — the site/content builder replaces this with the full Hoverline facts.
export const facts: BrandFacts = {
  company: {
    name: 'Hoverline',
    oneLiner: 'Autonomous drone inspection for refineries, power grids and mines.',
    disclosure:
      'Hoverline is a fictional company. This site is a portfolio project built with PageForge.',
  },
  siteTypes: {
    refinery: { label: 'Refinery', assets: [], typicalFindings: [], routeFacts: [] },
    substation: { label: 'Substation', assets: [], typicalFindings: [], routeFacts: [] },
    'open-pit': { label: 'Open-pit mine', assets: [], typicalFindings: [], routeFacts: [] },
  },
  capabilities: [],
  specs: [],
  stats: [],
  operators: [],
  caseStudies: [],
  testimonials: [],
  integrations: [],
  compliance: [],
  faqs: [],
  voice: { do: [], dont: [], bannedPhrases: [] },
}
