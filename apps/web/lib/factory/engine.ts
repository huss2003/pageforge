/**
 * Engine adapter: the ONLY module in apps/web that imports from
 * `@pageforge/agents` or `@pageforge/qa/dispatch`.
 *
 * The Factory talks to the agent pipeline and the QA dispatcher through the
 * names exported here, so swapping the temporary fallback for the real
 * packages is a two-line change (see the TEMP block below).
 */
import 'server-only'

export type {
  Brief,
  FixPage,
  LlmClient,
  PagePlan,
  PipelineDeps,
  PipelineResult,
  RunPipeline,
  RunStatus,
  StepLog,
  StepName,
} from '@pageforge/agents'

/** Signature of `dispatchQaRun` from `@pageforge/qa/dispatch`. */
export interface DispatchQaRunInput {
  runId: string
  url: string
  attempt: number
  callbackUrl: string
}

// TEMP until feat/agents merges — replace the next two lines with:
//   export { runPipeline, fixPage, createLlmFromEnv } from '@pageforge/agents'
//   export { dispatchQaRun } from '@pageforge/qa/dispatch'
// then delete ./engine-fallback.ts.
export { runPipeline, fixPage, createLlmFromEnv } from './engine-fallback'
export { dispatchQaRun } from './engine-fallback'
