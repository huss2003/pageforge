import type { BlockKind } from './schemas'

export interface BlockDefinition {
  kind: BlockKind
  /** Label in Sanity Studio and the Factory dashboard. */
  title: string
  /** Plain-language note for the planner agent: when this block earns a place. */
  aiUsage: string
  /** Hard placement rules the validator enforces. */
  placement?: 'first' | 'last' | 'any'
  /** Max times per page. */
  maxPerPage: number
}

export const registry: Record<BlockKind, BlockDefinition> = {
  hero: {
    kind: 'hero',
    title: 'Hero',
    aiUsage:
      'Always the first block. Use variant "route" when the prospect runs a physical site the drone flies over; "statement" for short campaign pages; "split" when showing the product report matters more than the site.',
    placement: 'first',
    maxPerPage: 1,
  },
  operatorStrip: {
    kind: 'operatorStrip',
    title: 'Operators using Hoverline',
    aiUsage:
      'Social proof right after the hero when the audience is cautious (safety, procurement). Use operators from the same sector as the prospect first.',
    maxPerPage: 1,
    placement: 'any',
  },
  statsBand: {
    kind: 'statsBand',
    title: 'Stats band',
    aiUsage:
      'Two to four outcome numbers that exist in the brand facts. Never invent a number. Use when the brief mentions cost, downtime or safety.',
    maxPerPage: 1,
    placement: 'any',
  },
  featureGrid: {
    kind: 'featureGrid',
    title: 'Capabilities',
    aiUsage:
      'What the platform does, phrased as outcomes for the audience. Use on product-led pages; pick features relevant to the prospect site type.',
    maxPerPage: 1,
    placement: 'any',
  },
  useCaseTabs: {
    kind: 'useCaseTabs',
    title: 'Use cases by site',
    aiUsage:
      'When the prospect has more than one asset type, or the page targets a whole sector. Each tab lists findings a flight typically produces.',
    maxPerPage: 1,
    placement: 'any',
  },
  howItWorks: {
    kind: 'howItWorks',
    title: 'How it works',
    aiUsage:
      'A real sequence: dock install, route planning, scheduled flights, findings to work orders. Use for audiences new to autonomous drones.',
    maxPerPage: 1,
    placement: 'any',
  },
  caseStudy: {
    kind: 'caseStudy',
    title: 'Case study',
    aiUsage:
      'Proof from an operator in the same sector as the prospect. Only use case studies present in the brand facts.',
    maxPerPage: 2,
    placement: 'any',
  },
  testimonial: {
    kind: 'testimonial',
    title: 'Testimonial',
    aiUsage: 'A single quote from the brand facts, matched to the audience role.',
    maxPerPage: 2,
    placement: 'any',
  },
  comparisonTable: {
    kind: 'comparisonTable',
    title: 'Comparison',
    aiUsage:
      'When the brief says the prospect uses manual inspection, rope access or a competitor. Compare against methods, not named competitors.',
    maxPerPage: 1,
    placement: 'any',
  },
  integrations: {
    kind: 'integrations',
    title: 'Integrations',
    aiUsage:
      'When the audience includes IT, maintenance planning or asset management. Only list integrations from the brand facts.',
    maxPerPage: 1,
    placement: 'any',
  },
  compliance: {
    kind: 'compliance',
    title: 'Compliance and safety',
    aiUsage:
      'For regulated sites (refineries, utilities) or security-conscious audiences. Only certifications from the brand facts.',
    maxPerPage: 1,
    placement: 'any',
  },
  faq: {
    kind: 'faq',
    title: 'FAQ',
    aiUsage:
      'Objections the audience will raise: airspace approval, data ownership, weather, cost.',
    maxPerPage: 1,
    placement: 'any',
  },
  ctaBand: {
    kind: 'ctaBand',
    title: 'Call to action',
    aiUsage: 'Closing call to action matching the brief goal. Use when there is no demo form.',
    maxPerPage: 1,
    placement: 'last',
  },
  demoForm: {
    kind: 'demoForm',
    title: 'Demo request form',
    aiUsage: 'Closing block when the goal is "book-demo". Replaces ctaBand.',
    maxPerPage: 1,
    placement: 'last',
  },
}
