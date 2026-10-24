/**
 * Block registry.
 *
 * Every marketing block is defined once and consumed by three systems:
 *  - the website renders it (packages/ui `BlockRenderer`)
 *  - Sanity Studio edits content shaped by its schema
 *  - the planner agent reads `aiUsage` to decide when the block fits a brief
 *
 * Because the AI can only emit blocks that exist here, generated pages are
 * always buildable by the design system.
 */
export * from './schemas'
export { registry, type BlockDefinition } from './registry'
