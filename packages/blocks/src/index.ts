/**
 * Block registry contract.
 *
 * Every marketing block is defined once and consumed by three systems:
 *  - the website renders `component`
 *  - Sanity Studio edits content shaped by `schema`
 *  - the planner agent reads `aiUsage` to decide when the block fits a brief
 *
 * Because the AI can only emit blocks that exist here, generated pages are
 * always buildable by the design system. Blocks are added in milestone M1.
 */
export type BlockKind =
  | 'hero'
  | 'logoWall'
  | 'statsBand'
  | 'featureGrid'
  | 'useCaseTabs'
  | 'howItWorks'
  | 'caseStudy'
  | 'testimonial'
  | 'comparisonTable'
  | 'integrations'
  | 'complianceBadges'
  | 'faq'
  | 'ctaBand'
  | 'demoForm'

export interface BlockDefinition<Props = unknown> {
  kind: BlockKind
  /** Human label shown in Sanity Studio and the Factory dashboard. */
  title: string
  /** Plain-language note for the planner agent: when to use this block. */
  aiUsage: string
  /** Example props, used by Storybook and as few-shot examples for the writer agent. */
  example: Props
}

export const blockRegistry: ReadonlyMap<BlockKind, BlockDefinition> = new Map()
