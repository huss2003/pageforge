/**
 * Agent pipeline contract.
 *
 *   brief → planner → writer → validator → Sanity draft → QA → fixer → publish
 *
 * Each step is a typed function so runs can be logged step by step to
 * Supabase and replayed when debugging. The pipeline never imports a
 * database or CMS client directly: the caller injects them via
 * `PipelineDeps`, which keeps this package testable with fakes.
 */
export * from './types'
