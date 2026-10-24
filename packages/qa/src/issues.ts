import type { QaIssue, QaThresholds } from './index'
import type { TargetRequest } from './dom-map'

/**
 * Pure conversion of raw Lighthouse / axe output into QaIssues.
 * Kept free of Node and browser APIs so it is unit-testable with fixtures.
 */

/** The parts of a Lighthouse result (LHR) we read. */
export interface LhrLike {
  lighthouseVersion?: string
  categories: Record<string, { score: number | null; auditRefs: { id: string; weight: number }[] }>
  audits: Record<
    string,
    {
      id: string
      title: string
      score: number | null
      scoreDisplayMode: string
      displayValue?: string
      details?: unknown
    }
  >
}

/** The parts of an axe violation we read. */
export interface AxeViolationLike {
  id: string
  impact?: string | null
  help: string
  helpUrl?: string
  nodes: { target: unknown[]; failureSummary?: string; html?: string }[]
}

export function lighthouseScores(lhr: LhrLike): QaThresholds {
  const s = (id: string) => Math.round((lhr.categories[id]?.score ?? 0) * 100)
  return {
    performance: s('performance'),
    accessibility: s('accessibility'),
    seo: s('seo'),
    bestPractices: s('best-practices'),
  }
}

interface LhNode {
  type: 'node'
  path?: string
  selector?: string
  snippet?: string
  nodeLabel?: string
}

/** Every `{type:'node'}` object anywhere in an audit's details. */
export function collectNodes(details: unknown, max = 50): LhNode[] {
  const out: LhNode[] = []
  const visit = (v: unknown) => {
    if (out.length >= max || !v || typeof v !== 'object') return
    if (Array.isArray(v)) {
      v.forEach(visit)
      return
    }
    const o = v as Record<string, unknown>
    if (o.type === 'node' && (typeof o.path === 'string' || typeof o.selector === 'string')) {
      out.push(o as unknown as LhNode)
      return
    }
    Object.values(o).forEach(visit)
  }
  visit(details)
  return out
}

/** Audits worth reporting: failing, scored, in one of our four categories. */
export function failingAudits(lhr: LhrLike, opts: { maxPerCategory?: number } = {}) {
  const max = opts.maxPerCategory ?? 12
  const seen = new Set<string>()
  const out: { category: string; audit: LhrLike['audits'][string] }[] = []
  for (const [category, cat] of Object.entries(lhr.categories)) {
    const failing = cat.auditRefs
      .map((ref) => ({ ref, audit: lhr.audits[ref.id] }))
      .filter(
        (x): x is { ref: { id: string; weight: number }; audit: LhrLike['audits'][string] } =>
          !!x.audit &&
          x.audit.score !== null &&
          x.audit.score < 0.9 &&
          ['binary', 'numeric', 'metricSavings'].includes(x.audit.scoreDisplayMode) &&
          // Perf metrics without weight are diagnostics; keep weighted metrics and opportunities.
          (category !== 'performance' ||
            x.ref.weight > 0 ||
            x.audit.scoreDisplayMode === 'metricSavings'),
      )
      .sort((a, b) => b.ref.weight - a.ref.weight || (a.audit.score ?? 0) - (b.audit.score ?? 0))
      .slice(0, max)
    for (const { audit } of failing) {
      if (seen.has(audit.id)) continue
      seen.add(audit.id)
      out.push({ category, audit })
    }
  }
  return out
}

/** Requests to trace Lighthouse nodes and axe targets back to block keys in the page. */
export function targetRequests(
  lhr: LhrLike | undefined,
  violations: AxeViolationLike[],
): TargetRequest[] {
  const reqs: TargetRequest[] = []
  if (lhr) {
    for (const { audit } of failingAudits(lhr)) {
      collectNodes(audit.details, 10).forEach((n, i) =>
        reqs.push({ id: `lh:${audit.id}:${i}`, path: n.path, selector: n.selector }),
      )
    }
  }
  violations.forEach((v) =>
    v.nodes
      .slice(0, 20)
      .forEach((n, i) =>
        reqs.push({ id: `axe:${v.id}:${i}`, target: n.target as (string | string[])[] }),
      ),
  )
  return reqs
}

/**
 * One QaIssue per (rule, block). Nodes outside any block (site chrome)
 * are grouped into a single issue without a blockKey.
 */
export function buildIssues(input: {
  lhr?: LhrLike
  violations: AxeViolationLike[]
  keyMap: Record<string, string | null>
}): QaIssue[] {
  const issues: QaIssue[] = []
  /** Group node indexes by block key (null = outside any block), first-seen order. */
  const group = (count: number, prefix: string) => {
    const groups = new Map<string | null, number[]>()
    for (let i = 0; i < count; i++) {
      const key = input.keyMap[`${prefix}:${i}`] ?? null
      groups.set(key, [...(groups.get(key) ?? []), i])
    }
    if (groups.size === 0) groups.set(null, [])
    return groups
  }
  const push = (source: QaIssue['source'], id: string, key: string | null, message: string) =>
    issues.push(key ? { source, id, message, blockKey: key } : { source, id, message })

  if (input.lhr) {
    for (const { category, audit } of failingAudits(input.lhr)) {
      const nodes = collectNodes(audit.details, 10)
      const value = audit.displayValue ? ` (${audit.displayValue})` : ''
      for (const [key, idx] of group(nodes.length, `lh:${audit.id}`)) {
        const first = idx[0] === undefined ? undefined : nodes[idx[0]]
        const label = first?.nodeLabel ? `: ${first.nodeLabel.slice(0, 80)}` : ''
        push('lighthouse', audit.id, key, `[${category}] ${audit.title}${value}${label}`)
      }
    }
  }

  for (const v of input.violations) {
    const nodes = v.nodes.slice(0, 20)
    const impact = v.impact ? `${v.impact}: ` : ''
    for (const [key, idx] of group(nodes.length, `axe:${v.id}`)) {
      const first = idx[0] === undefined ? undefined : nodes[idx[0]]
      const summary = first?.failureSummary?.split('\n').slice(1, 2).join(' ').trim()
      const n = Math.max(idx.length, 1)
      push(
        'axe',
        v.id,
        key,
        `${impact}${v.help}${summary ? ` — ${summary}` : ''} (${n} node${n === 1 ? '' : 's'})`,
      )
    }
  }
  return issues
}

export function axeCounts(violations: AxeViolationLike[]) {
  const counts: Partial<Record<'critical' | 'serious' | 'moderate' | 'minor', number>> = {}
  for (const v of violations) {
    const k = (v.impact ?? 'minor') as keyof typeof counts
    counts[k] = (counts[k] ?? 0) + 1
  }
  return counts
}
