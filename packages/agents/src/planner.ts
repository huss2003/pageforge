import { registry, type BlockKind } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import { factIds } from './facts'
import { closingKind } from './goals'
import { plannerPrompt } from './prompts'
import { pagePlanSchema, plannerOutputSchema } from './schemas'
import { clip, slugify } from './text'
import type { Brief, LlmClient, LlmResult, PagePlan } from './types'

type RawPlan = {
  title: string
  slug: string
  angle: string
  sections: { kind: BlockKind; purpose: string; factIds: string[] }[]
}

export interface PlanOutcome extends LlmResult<PagePlan> {
  /** Deterministic corrections applied to the model's plan (logged, not retried). */
  repairs: string[]
}

/**
 * Planner: one model call returns an outline; structural rules (hero first,
 * closing block per goal, max per page, 5–9 sections, real fact ids) are then
 * enforced in code so a slightly-off plan never costs a second call.
 */
export async function planPage(
  brief: Brief,
  deps: { llm: LlmClient; facts: BrandFacts },
): Promise<PlanOutcome> {
  const { system, prompt } = plannerPrompt(brief, deps.facts)
  const res = await deps.llm.generateJson({
    system,
    prompt,
    schema: plannerOutputSchema,
    task: 'planner',
    temperature: 0.3,
  })
  const { plan, repairs } = normalizePlan(res.data, brief, deps.facts)
  return { data: plan, model: res.model, tokens: res.tokens, repairs }
}

/** Whether the brand facts hold enough material to fill a block's minimums. */
export function blockAvailable(kind: BlockKind, facts: BrandFacts): boolean {
  switch (kind) {
    case 'operatorStrip':
      return facts.operators.length >= 3
    case 'statsBand':
      return facts.stats.length >= 2
    case 'featureGrid':
      return facts.capabilities.length >= 2
    case 'useCaseTabs':
      return Object.values(facts.siteTypes).filter((s) => s.typicalFindings.length >= 2).length >= 2
    case 'caseStudy':
      return facts.caseStudies.some((c) => c.metrics.length >= 2)
    case 'testimonial':
      return facts.testimonials.length >= 1
    case 'comparisonTable':
      return facts.capabilities.length + facts.specs.length >= 3
    case 'integrations':
      return facts.integrations.length >= 3
    case 'compliance':
      return facts.compliance.length >= 2
    case 'faq':
      return facts.faqs.length >= 2
    default:
      return true
  }
}

/** Fallback filler sections, in order of usefulness, when a plan is too short. */
const FILLERS: BlockKind[] = [
  'featureGrid',
  'howItWorks',
  'statsBand',
  'caseStudy',
  'faq',
  'operatorStrip',
]

export function normalizePlan(
  raw: RawPlan,
  brief: Brief,
  facts: BrandFacts,
): { plan: PagePlan; repairs: string[] } {
  const repairs: string[] = []
  const known = factIds(facts)
  const closing = closingKind(brief.goal)
  const counts = new Map<BlockKind, number>()

  let sections = raw.sections
    .map((s) => {
      const ids = s.factIds.filter((id) => known.has(id))
      if (ids.length !== s.factIds.length) {
        repairs.push(`dropped unknown fact ids in ${s.kind}`)
      }
      return { kind: s.kind, purpose: clip(s.purpose, 200), factIds: [...new Set(ids)] }
    })
    .filter((s) => {
      if (s.kind === 'hero' || s.kind === 'ctaBand' || s.kind === 'demoForm') return false
      if (!blockAvailable(s.kind, facts)) {
        repairs.push(`removed ${s.kind}: not enough brand facts`)
        return false
      }
      const n = (counts.get(s.kind) ?? 0) + 1
      counts.set(s.kind, n)
      if (n > registry[s.kind].maxPerPage) {
        repairs.push(`removed extra ${s.kind}`)
        return false
      }
      return true
    })

  const hero = raw.sections.find((s) => s.kind === 'hero')
  const close = raw.sections.find((s) => s.kind === closing)
  if (raw.sections[0]?.kind !== 'hero') repairs.push('moved hero to the top')
  if (raw.sections[raw.sections.length - 1]?.kind !== closing) {
    repairs.push(`closing block set to ${closing}`)
  }

  // Middle sections: 3–7 so the total lands in 5–9.
  if (sections.length > 7) {
    repairs.push(`trimmed ${sections.length - 7} sections`)
    sections = sections.slice(0, 7)
  }
  for (const kind of FILLERS) {
    if (sections.length >= 3) break
    if (sections.some((s) => s.kind === kind) || !blockAvailable(kind, facts)) continue
    sections.push({
      kind,
      purpose: `Support the angle with ${registry[kind].title.toLowerCase()}.`,
      factIds: [],
    })
    repairs.push(`added ${kind} to reach five sections`)
  }

  const title = clip(raw.title, 90)
  const slug =
    slugify(raw.slug, 60) || slugify(`${brief.prospect} ${brief.siteType}`, 60) || 'landing'
  if (slug !== raw.slug) repairs.push('normalised slug')

  const plan = pagePlanSchema.parse({
    title,
    slug,
    angle: clip(raw.angle, 120),
    sections: [
      {
        kind: 'hero',
        purpose: clip(hero?.purpose ?? 'State the problem this prospect has and the outcome.', 200),
        factIds: (hero?.factIds ?? []).filter((id) => known.has(id)),
      },
      ...sections,
      {
        kind: closing,
        purpose: clip(close?.purpose ?? 'Ask for the next step in plain words.', 200),
        factIds: (close?.factIds ?? []).filter((id) => known.has(id)),
      },
    ],
  })
  return { plan, repairs: [...new Set(repairs)] }
}
