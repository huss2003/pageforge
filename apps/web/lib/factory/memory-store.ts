import { randomUUID } from 'node:crypto'
import type { StepLog } from './engine'
import {
  summarize,
  type FactoryStore,
  type NewRun,
  type QaRecord,
  type RunExpectation,
  type RunMode,
  type RunPatch,
  type RunRecord,
  type StoredStep,
} from './types'

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10)
const clone = <T>(v: T): T => structuredClone(v)

/**
 * In-memory store. State lives on one server instance only: on Vercel each
 * function instance has its own copy and it resets on cold start. The
 * Factory UI says so when this store is active.
 */
export function createMemoryStore(now: () => Date = () => new Date()): FactoryStore {
  const runs = new Map<string, RunRecord>()
  const steps = new Map<string, StoredStep[]>()
  const qa = new Map<string, QaRecord[]>()
  const limits = new Map<string, number>()
  let stepSeq = 0

  const mustGet = (id: string) => {
    const run = runs.get(id)
    if (!run) throw new Error(`Run ${id} not found`)
    return run
  }

  const apply = (run: RunRecord, patch: RunPatch) => {
    const next = { ...run, ...clone(patch), updatedAt: now().toISOString() }
    runs.set(run.id, next)
    return clone(next)
  }

  const matches = (run: RunRecord, expect: RunExpectation) => {
    const statuses = Array.isArray(expect.status) ? expect.status : [expect.status]
    if (!statuses.includes(run.status)) return false
    if (expect.qaAttempts !== undefined && run.qaAttempts !== expect.qaAttempts) return false
    return true
  }

  return {
    kind: 'memory',

    async createRun(input: NewRun) {
      const ts = now().toISOString()
      const run: RunRecord = {
        id: randomUUID(),
        createdAt: ts,
        updatedAt: ts,
        mode: input.mode,
        status: 'queued',
        brief: clone(input.brief),
        plan: null,
        page: null,
        slug: null,
        draftId: null,
        previewUrl: null,
        qaAttempts: 0,
        lastQa: null,
        fixes: [],
        error: null,
        model: null,
        simulated: input.simulated,
        ipHash: input.ipHash,
        startedAt: null,
        readyAt: null,
        publishedAt: null,
        timeToShipMs: null,
      }
      runs.set(run.id, run)
      return clone(run)
    },

    async getRun(id) {
      const run = runs.get(id)
      return run ? clone(run) : null
    },

    async updateRun(id, patch) {
      return apply(mustGet(id), patch)
    },

    async claimRun(id, expect, patch) {
      // Check and write happen in one synchronous turn: no other request can interleave.
      const run = runs.get(id)
      if (!run || !matches(run, expect)) return null
      return apply(run, patch)
    },

    async findPublished(mode: RunMode, slug: string) {
      for (const run of runs.values()) {
        if (run.mode === mode && run.slug === slug && run.status === 'published') return clone(run)
      }
      return null
    },

    async appendStep(runId: string, step: StepLog) {
      const list = steps.get(runId) ?? []
      list.push({ ...clone(step), id: ++stepSeq })
      steps.set(runId, list)
    },

    async listSteps(runId) {
      return clone(steps.get(runId) ?? [])
    },

    async addQaResult(runId, result) {
      const list = qa.get(runId) ?? []
      if (list.some((r) => r.attempt === result.attempt)) return false
      list.push(clone(result))
      list.sort((a, b) => a.attempt - b.attempt)
      qa.set(runId, list)
      return true
    },

    async listQaResults(runId) {
      return clone(qa.get(runId) ?? [])
    },

    async listRecentRuns(limit) {
      return [...runs.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((r) =>
          summarize(
            r,
            qa.get(r.id)?.find((q) => q.attempt === 1),
          ),
        )
    },

    async countRunsSince(since) {
      const iso = since.toISOString()
      let n = 0
      for (const run of runs.values()) if (run.createdAt >= iso) n++
      return n
    },

    async hitRateLimit(key, limit) {
      const k = `${utcDay(now())}:${key}`
      const count = (limits.get(k) ?? 0) + 1
      limits.set(k, count)
      return count <= limit
    },

    async peekRateLimit(key) {
      return limits.get(`${utcDay(now())}:${key}`) ?? 0
    },
  }
}
