/**
 * Engine adapter: the ONLY module in apps/web that imports from
 * `@pageforge/agents` or `@pageforge/qa/dispatch`.
 *
 * The Factory talks to the agent pipeline and the QA dispatcher through the
 * names exported here, so the rest of the app never depends on how models
 * are chosen or how QA is triggered.
 */
import 'server-only'
import { createLlmFromEnv as createAgentsLlm, type LlmClient } from '@pageforge/agents'
import { facts } from '@pageforge/content'

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

export { runPipeline, fixPage } from '@pageforge/agents'
export { dispatchQaRun } from '@pageforge/qa/dispatch'

/** Signature of `dispatchQaRun` from `@pageforge/qa/dispatch`. */
export interface DispatchQaRunInput {
  runId: string
  url: string
  attempt: number
  callbackUrl: string
}

/**
 * Gemini (primary) → Groq (fallback) when keys exist; otherwise the offline
 * fake model, flagged `simulated` so the dashboard says so. Simulated calls
 * are paced so the public demo timeline is watchable.
 */
export function createLlmFromEnv(
  env: Record<string, string | undefined>,
): LlmClient & { simulated: boolean; models: string[] } {
  const { llm, simulated, models } = createAgentsLlm(env, {
    facts,
    simulatedLatencyMs: 1500,
  })
  return Object.assign(llm, { simulated, models })
}
