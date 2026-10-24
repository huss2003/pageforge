import 'server-only'
import { getConfig } from './config'
import { getRuntime } from './store'
import type { RunSummary } from './types'

export interface FactoryStats {
  window: number
  runs: number
  published: number
  /** Median brief → live across published runs, ms. Null until one is published. */
  medianTimeToShipMs: number | null
  /** Share of runs whose first QA attempt passed, 0–1. Null until one is tested. */
  firstTryPassRate: number | null
  tested: number
  /** Mean fixer passes per tested run. */
  avgFixesPerRun: number | null
  modelMix: { model: string; runs: number }[]
  today: { runs: number; cap: number }
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2)
}

export function statsFrom(rows: RunSummary[], todayRuns: number, cap: number): FactoryStats {
  const shipped = rows.filter((r) => r.timeToShipMs != null)
  const tested = rows.filter((r) => r.firstQaPassed != null)
  const mix = new Map<string, number>()
  for (const r of rows) {
    if (!r.model) continue
    mix.set(r.model, (mix.get(r.model) ?? 0) + 1)
  }
  return {
    window: 50,
    runs: rows.length,
    published: shipped.length,
    medianTimeToShipMs: median(shipped.map((r) => r.timeToShipMs!)),
    firstTryPassRate: tested.length
      ? tested.filter((r) => r.firstQaPassed).length / tested.length
      : null,
    tested: tested.length,
    avgFixesPerRun: tested.length ? tested.reduce((n, r) => n + r.fixes, 0) / tested.length : null,
    modelMix: [...mix.entries()]
      .map(([model, runs]) => ({ model, runs }))
      .sort((a, b) => b.runs - a.runs),
    today: { runs: todayRuns, cap },
  }
}

export async function computeStats(): Promise<FactoryStats> {
  const { store, now } = getRuntime()
  const start = now()
  start.setUTCHours(0, 0, 0, 0)
  const [rows, today] = await Promise.all([store.listRecentRuns(50), store.countRunsSince(start)])
  return statsFrom(rows, today, getConfig().limits.globalPerDay)
}
