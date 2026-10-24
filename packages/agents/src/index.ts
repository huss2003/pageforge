/**
 * Agent pipeline.
 *
 *   brief → planner → writer → validator → Sanity draft → QA → fixer → publish
 *
 * Each step is a typed function so runs can be logged step by step to
 * Supabase and replayed when debugging. The pipeline never imports a
 * database or CMS client directly: the caller injects them via
 * `PipelineDeps`, which keeps this package testable with fakes.
 */
export * from './types'
export * from './llm'
export { runPipeline, PipelineError, MAX_WRITE_RETRIES, createStepRecorder } from './pipeline'
export { fixPage, applyDeterministicFix, inferGoal, FIXABLE, FIX_LIMITS } from './fixer'
export { planPage, normalizePlan, blockAvailable, type PlanOutcome } from './planner'
export { writePage, rewritePage, finalizePage, mergeBlocks } from './writer'
export {
  validatePage,
  SEO_LIMITS,
  RESERVED_SLUGS,
  type ValidationIssue,
  type ValidationResult,
  type ValidationRule,
  type ValidateOptions,
} from './validator'
export {
  briefSchema,
  pagePlanSchema,
  plannerOutputSchema,
  writerOutputSchema,
  fixerOutputSchema,
} from './schemas'
export {
  plannerPrompt,
  writerPrompt,
  writerRetryPrompt,
  fixerPrompt,
  writerSystem,
} from './prompts'
export { blockShape, blockShapes } from './prompts/shapes'
export { factIndex, factDetail, factIds } from './facts'
export { GOAL_CTAS, closingKind, GENERIC_LINK_LABELS } from './goals'
