import 'server-only'
import { liveUrlFor } from './orchestrator'
import { getStore } from './store'
import { toPublicRun, type RunPayload } from './types'

export type { RunPayload } from './types'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getRunPayload(id: string): Promise<RunPayload | null> {
  if (!uuid.test(id)) return null
  const store = getStore()
  const run = await store.getRun(id)
  if (!run) return null
  const [steps, qa] = await Promise.all([store.listSteps(id), store.listQaResults(id)])
  return {
    run: toPublicRun(run),
    steps,
    qa,
    liveUrl: run.status === 'published' ? liveUrlFor(run) : null,
  }
}

export function notFoundMessage(): string {
  return getStore().kind === 'memory'
    ? 'Run not found. Simulation keeps runs in server memory, so they disappear when the server restarts or another instance answers. Start a new run.'
    : 'Run not found. Check the link or start a new run.'
}
