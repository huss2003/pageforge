// TEMP until feat/agents merges — this whole file is deleted when
// lib/factory/engine.ts re-exports the real implementations from
// `@pageforge/agents` and `@pageforge/qa/dispatch`.
//
// It is a deterministic stand-in with the same signatures: a fake LLM that
// "plans" and "writes" Hoverline pages from templates, a fixer that patches
// the QA issues the simulated QA reports, and a QA dispatcher that refuses
// to run (live QA needs the real package).
import { z } from 'zod'
import { pageSchema, registry, type Block, type BlockKind, type Page } from '@pageforge/blocks'
import type { QaResult } from '@pageforge/qa'
import type {
  Brief,
  FixPage,
  LlmClient,
  LlmResult,
  PagePlan,
  RunPipeline,
  RunStatus,
  StepLog,
  StepName,
} from '@pageforge/agents'
import type { DispatchQaRunInput } from './engine'

// TEMP until feat/agents merges
const SIM_MODEL = 'simulated'

// TEMP until feat/agents merges
function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const estimateTokens = (s: string) => Math.max(1, Math.round(s.length / 4))

// TEMP until feat/agents merges
function slugify(text: string, maxWords = 6): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter((w) => w && !['a', 'an', 'the', 'with', 'and', 'of', 'its', 'for'].includes(w))
    .slice(0, maxWords)
    .join('-')
    .slice(0, 72)
    .replace(/-+$/, '')
}

// ---------------------------------------------------------------------------
// Template copy (TEMP until feat/agents merges; the real writer uses BrandFacts)
// ---------------------------------------------------------------------------

const siteCopy = {
  refinery: {
    label: 'refinery',
    heading: 'Find tank and flare corrosion while the unit keeps running',
    sub: 'A docked Hoverline drone flies the same route over tank roofs, flare stacks and pipe racks every shift, and sends each finding to your maintenance planner with a photo and a location.',
    operator: 'Bayline Refining',
    caseHeading: 'Bayline caught roof corrosion on two crude tanks a full turnaround early',
    caseSummary:
      'Bayline replaced twice-yearly rope-access surveys with daily routes over its tank farm. In the first quarter the drone flagged pitting on two floating roofs that the previous survey had rated sound.',
    metrics: [
      { value: '9 days', label: 'turnaround slip avoided on the next outage' },
      { value: '0', label: 'people working at height for routine surveys' },
    ],
    findings: ['Pitting on floating tank roofs', 'Hot spots on flare tips', 'Insulation damage'],
    compliance: [
      { name: 'API 653 support', detail: 'Survey records formatted for tank inspection files.' },
      { name: 'ATEX zone 2 dock', detail: 'Dock and charger rated for hazardous-area siting.' },
    ],
  },
  substation: {
    label: 'substation',
    heading: 'Thermal-check every substation on a schedule, not a contract cycle',
    sub: 'Hoverline docks fly radiometric routes over transformers, bushings and busbars, flag hot joints against a baseline, and file a work order before a fault trips the feeder.',
    operator: 'Northgrid Utilities',
    caseHeading: 'Northgrid moved 140 substations from quarterly to weekly thermal checks',
    caseSummary:
      'Northgrid ran contractor thermal surveys once a quarter. With six docks covering two states, every substation is now flown weekly and hot joints reach the planner the same day.',
    metrics: [
      { value: '12×', label: 'more thermal checks per substation each year' },
      { value: '31', label: 'hot joints repaired before failure in year one' },
    ],
    findings: ['Hot bushings and clamps', 'Oil leaks on transformers', 'Vegetation encroachment'],
    compliance: [
      { name: 'NERC CIP-aware', detail: 'Imagery stays in your tenant; no remote access path.' },
      {
        name: 'BVLOS waiver',
        detail: 'Routes flown under an approved beyond-line-of-sight waiver.',
      },
    ],
  },
  'open-pit': {
    label: 'open-pit mine',
    heading: 'Watch the pit wall move in millimetres, every single day',
    sub: 'Hoverline flies photogrammetry routes over pit walls and haul roads each morning, compares the surface with yesterday, and alerts the geotech team when a slope starts to creep.',
    operator: 'Cerro Alto Copper',
    caseHeading: 'Cerro Alto spotted east-wall creep eleven days before a planned blast',
    caseSummary:
      'Cerro Alto surveyed its east wall weekly by hand. Daily flights now build a surface model each morning, and the geotech team saw 14 mm of creep near a haul road in time to reroute trucks.',
    metrics: [
      { value: '14 mm', label: 'slope movement detected before a planned blast' },
      { value: '7×', label: 'more wall surveys per week' },
    ],
    findings: ['Slope creep and tension cracks', 'Haul-road berm damage', 'Ponding near the toe'],
    compliance: [
      { name: 'MSHA ground control', detail: 'Survey history kept for ground-control plans.' },
      { name: 'Blast-aware routing', detail: 'Flights pause automatically inside blast windows.' },
    ],
  },
} as const

const goalCta = {
  'book-demo': { label: 'Book a demo', href: '#demo' },
  'download-report': { label: 'Get the sample report', href: '#report' },
  'contact-sales': { label: 'Talk to sales', href: '#contact' },
} as const

const purposes: Record<BlockKind, (b: Brief) => string> = {
  hero: (b) => `Open on the ${siteCopy[b.siteType].label} problem in the prospect's own terms.`,
  operatorStrip: (b) =>
    `Reassure ${b.audience.join(' and ')} that similar operators already fly Hoverline.`,
  statsBand: () => 'Put outcome numbers from the brand facts where cautious readers look first.',
  featureGrid: (b) => `Explain what the platform does as outcomes for ${b.audience[0]}.`,
  useCaseTabs: () => 'Show findings by asset type.',
  howItWorks: () => 'Walk through dock install, route, scheduled flights and work orders.',
  caseStudy: (b) => `Proof from a ${siteCopy[b.siteType].label} operator like the prospect.`,
  testimonial: () => 'A quote matched to the audience role.',
  comparisonTable: () => 'Compare scheduled flights against the method named in the notes.',
  integrations: () => 'Show that findings land in the maintenance system they already use.',
  compliance: () => 'Answer the safety and regulatory question before it is asked.',
  faq: () => 'Handle airspace, data ownership, weather and cost objections.',
  ctaBand: (b) => `Close on the goal: ${goalCta[b.goal].label.toLowerCase()}.`,
  demoForm: () => 'Close with the demo request form and what happens after submitting.',
}

function planFor(brief: Brief): PagePlan {
  const notes = (brief.notes ?? '').toLowerCase()
  const roles = brief.audience.join(' ').toLowerCase()
  const kinds: BlockKind[] = ['hero']
  if (/hse|safety|procurement/.test(roles)) kinds.push('operatorStrip')
  kinds.push('statsBand', 'howItWorks', 'caseStudy')
  if (/rope|manual|by hand|contractor|scaffold/.test(notes)) kinds.push('comparisonTable')
  if (/reliab|maint|sap|maximo|it\b/.test(roles + ' ' + notes)) kinds.push('integrations')
  if (brief.siteType !== 'open-pit' || /hse|safety/.test(roles)) kinds.push('compliance')
  kinds.push('faq', brief.goal === 'book-demo' ? 'demoForm' : 'ctaBand')
  const site = siteCopy[brief.siteType]
  return {
    title: `Hoverline for ${brief.prospect}`.slice(0, 90),
    slug: slugify(`${site.label} inspection ${brief.prospect}`),
    angle: `Scheduled drone flights replace periodic surveys at the ${site.label}; lead with what ${brief.audience[0]} loses today when findings arrive late.`,
    sections: kinds.map((kind) => ({ kind, purpose: purposes[kind](brief), factIds: [] })),
  }
}

/** `defects` lets the simulated writer leave realistic mistakes for QA to catch. */
function writePage(brief: Brief, plan: PagePlan, defects: number): Page {
  const site = siteCopy[brief.siteType]
  const blocks: Block[] = plan.sections.map((s, i): Block => {
    const _key = `${s.kind}-${i + 1}`
    switch (s.kind) {
      case 'hero':
        return {
          _key,
          _type: 'hero',
          variant: 'route',
          heading: site.heading,
          subheading: site.sub,
          primaryCta: { ...goalCta[brief.goal] },
          secondaryCta:
            defects >= 1
              ? { label: 'Learn more', href: '#how-it-works' }
              : { label: 'See how a route is flown', href: '#how-it-works' },
          siteType: brief.siteType,
        }
      case 'operatorStrip':
        return {
          _key,
          _type: 'operatorStrip',
          heading: 'Flying daily routes for operators like you',
          operators: [
            { name: 'Bayline Refining', sector: 'Refining' },
            { name: 'Northgrid Utilities', sector: 'Power' },
            { name: 'Cerro Alto Copper', sector: 'Mining' },
            { name: 'Port Arden Terminals', sector: 'Storage' },
          ],
        }
      case 'statsBand':
        return {
          _key,
          _type: 'statsBand',
          stats: [
            { value: '38', unit: 'min', label: 'median route time per site', basis: '2025 fleet' },
            { value: '4.1', unit: 'days', label: 'earlier detection than manual rounds' },
            { value: '0', label: 'climbs for routine visual surveys' },
          ],
        }
      case 'howItWorks':
        return {
          _key,
          _type: 'howItWorks',
          heading: 'From dock install to work order in four steps',
          steps: [
            {
              title: 'Install the dock',
              body: 'One weatherproof dock per site, sited with your HSE team in a day.',
            },
            {
              title: 'Plan the route',
              body: 'We map waypoints over every asset you name and agree the flight window.',
            },
            {
              title: 'Fly on schedule',
              body: 'The drone launches itself, flies the route and returns to charge.',
            },
            {
              title: 'Act on findings',
              body: 'Each finding arrives with a photo, a location and a severity.',
            },
          ],
        }
      case 'caseStudy':
        return {
          _key,
          _type: 'caseStudy',
          operator: site.operator,
          siteType: brief.siteType,
          heading: site.caseHeading,
          summary: site.caseSummary,
          metrics: site.metrics.map((m) => ({ ...m })),
        }
      case 'comparisonTable':
        return {
          _key,
          _type: 'comparisonTable',
          heading: 'Scheduled flights against periodic surveys',
          columns: ['Hoverline', 'Rope access', 'Contractor survey'],
          rows: [
            { label: 'Survey frequency', values: ['Every shift', 'Twice a year', 'Quarterly'] },
            { label: 'People at height', values: [false, true, false] },
            { label: 'Findings with location', values: [true, false, true] },
            { label: 'Runs during operations', values: [true, false, 'Partly'] },
          ],
        }
      case 'integrations':
        return {
          _key,
          _type: 'integrations',
          heading: 'Findings land where work gets planned',
          items: [
            { name: 'SAP PM', category: 'Work orders' },
            { name: 'IBM Maximo', category: 'Work orders' },
            { name: 'AVEVA PI', category: 'Historian' },
            { name: 'Esri ArcGIS', category: 'Mapping' },
          ],
        }
      case 'compliance':
        return {
          _key,
          _type: 'compliance',
          heading: 'Built for regulated sites',
          items: site.compliance.map((c) => ({ ...c })),
        }
      case 'faq':
        return {
          _key,
          _type: 'faq',
          heading: 'Questions operations teams ask first',
          items: [
            {
              question: 'Who handles airspace approval?',
              answer:
                'We prepare and file the waiver with you; most sites are approved within six weeks.',
            },
            {
              question: 'Who owns the imagery?',
              answer:
                'You do. Imagery and findings stay in your tenant and can be exported at any time.',
            },
            {
              question: 'What happens in bad weather?',
              answer:
                'The dock checks wind and rain before launch and reschedules the route if limits are exceeded.',
            },
          ],
        }
      case 'demoForm':
        return {
          _key,
          _type: 'demoForm',
          heading: `See a route planned for your ${site.label}`,
          body: 'Tell us about the site and we will bring a sample route and a findings report to the call.',
          submitLabel: 'Request the demo',
          nextSteps: [
            'A solutions engineer replies within one working day.',
            'We review a site plan with you and sketch the first route.',
          ],
        }
      case 'ctaBand':
        return {
          _key,
          _type: 'ctaBand',
          heading:
            brief.goal === 'download-report'
              ? `Read a full findings report from a ${site.label}`
              : `Price a Hoverline rollout for your ${site.label}s`,
          body: `Typical findings: ${site.findings.join(', ').toLowerCase()}.`,
          cta: { ...goalCta[brief.goal] },
        }
      default:
        throw new Error(`Template has no copy for ${s.kind}`)
    }
  })

  const description =
    defects >= 2
      ? 'Drone inspection for your site.'
      : `${site.sub.split(',')[0]}. Scheduled routes, findings with photos, and work orders in your planner.`.slice(
          0,
          160,
        )

  return {
    kind: 'landing',
    title: plan.title,
    slug: plan.slug,
    seo: {
      title: `Drone inspection for ${site.label} teams | Hoverline`.slice(0, 60),
      description,
      noindex: true,
    },
    blocks,
  }
}

/** Patches the issues the simulated QA can raise. */
function fixFor(page: Page, qa: QaResult): Page {
  const next = structuredClone(page)
  for (const issue of qa.issues) {
    if (issue.id === 'link-name' || issue.id === 'link-text') {
      for (const b of next.blocks) {
        if (
          b._type === 'hero' &&
          b.secondaryCta &&
          /^(learn|read) more$/i.test(b.secondaryCta.label)
        ) {
          b.secondaryCta = { ...b.secondaryCta, label: 'See how a route is flown' }
        }
      }
    }
    if (issue.id === 'meta-description') {
      const hero = next.blocks.find((b) => b._type === 'hero')
      const base = hero && hero._type === 'hero' ? hero.subheading : next.title
      next.seo.description = base.slice(0, 157).replace(/[\s,;]+\S*$/, '') + '.'
    }
  }
  return next
}

// ---------------------------------------------------------------------------
// Fake LLM (TEMP until feat/agents merges)
// ---------------------------------------------------------------------------

const planInput = z.object({ brief: z.any() })

function createFakeLlm(): LlmClient & { simulated: boolean } {
  return {
    simulated: true,
    async generateJson<T>(opts: {
      system: string
      prompt: string
      schema: z.ZodType<T>
      task: string
    }): Promise<LlmResult<T>> {
      const input = JSON.parse(opts.prompt) as Record<string, unknown>
      let raw: unknown
      if (opts.task === 'planner') raw = planFor(planInput.parse(input).brief as Brief)
      else if (opts.task === 'writer')
        raw = writePage(input.brief as Brief, input.plan as PagePlan, Number(input.defects ?? 0))
      else if (opts.task === 'fixer') raw = fixFor(input.page as Page, input.qa as QaResult)
      else throw new Error(`Fake LLM has no task "${opts.task}"`)
      const data = opts.schema.parse(raw)
      return {
        data,
        model: SIM_MODEL,
        tokens: {
          input: estimateTokens(opts.system + opts.prompt),
          output: estimateTokens(JSON.stringify(data)),
        },
      }
    },
  }
}

/** TEMP until feat/agents merges: always simulated; real models need @pageforge/agents. */
export function createLlmFromEnv(
  env: Record<string, string | undefined>,
): LlmClient & { simulated: boolean } {
  void env
  return createFakeLlm()
}

// ---------------------------------------------------------------------------
// Pipeline (TEMP until feat/agents merges)
// ---------------------------------------------------------------------------

const planSchema: z.ZodType<PagePlan> = z.object({
  title: z.string(),
  slug: z.string(),
  angle: z.string(),
  sections: z.array(
    z.object({
      kind: z.custom<BlockKind>((v) => typeof v === 'string' && v in registry),
      purpose: z.string(),
      factIds: z.array(z.string()),
    }),
  ),
})

export const runPipeline: RunPipeline = async (brief, deps) => {
  const now = deps.now ?? (() => new Date())
  const steps: StepLog[] = []

  async function step<T>(
    name: StepName,
    status: RunStatus,
    fn: () => Promise<{ value: T; model?: string; tokens?: StepLog['tokens']; summary: string }>,
  ): Promise<T> {
    const started = now()
    try {
      const r = await fn()
      const log: StepLog = {
        step: name,
        attempt: 1,
        model: r.model,
        startedAt: started.toISOString(),
        durationMs: now().getTime() - started.getTime(),
        tokens: r.tokens,
        ok: true,
        summary: r.summary,
      }
      steps.push(log)
      await deps.onStep?.(log, status)
      return r.value
    } catch (err) {
      const log: StepLog = {
        step: name,
        attempt: 1,
        startedAt: started.toISOString(),
        durationMs: now().getTime() - started.getTime(),
        ok: false,
        summary: `${name} failed`,
        error: err instanceof Error ? err.message : String(err),
      }
      steps.push(log)
      await deps.onStep?.(log, 'failed')
      throw err
    }
  }

  const plan = await step('plan', 'writing', async () => {
    const r = await deps.llm.generateJson({
      system: 'You are the PageForge planner.',
      prompt: JSON.stringify({ brief }),
      schema: planSchema,
      task: 'planner',
    })
    return {
      value: r.data,
      model: r.model,
      tokens: r.tokens,
      summary: `Planned ${r.data.sections.length} sections: ${r.data.sections.map((s) => registry[s.kind].title).join(', ')}.`,
    }
  })

  const defects = hash(JSON.stringify(brief) + now().getTime()) % 3
  const draftPage = await step('write', 'validating', async () => {
    const r = await deps.llm.generateJson({
      system: 'You are the PageForge writer.',
      prompt: JSON.stringify({ brief, plan, defects }),
      schema: pageSchema,
      task: 'writer',
    })
    const words = JSON.stringify(r.data.blocks).split(/\s+/).length
    return {
      value: r.data,
      model: r.model,
      tokens: r.tokens,
      summary: `Wrote ${r.data.blocks.length} blocks, about ${words} words, for ${brief.audience.join(' and ')}.`,
    }
  })

  const page = await step('validate', 'drafted', async () => {
    const parsed = pageSchema.parse(draftPage)
    const first = parsed.blocks[0]?._type
    if (first !== 'hero') throw new Error('The first block must be a hero.')
    return {
      value: parsed,
      summary: `Schema, placement and per-page limits pass for all ${parsed.blocks.length} blocks.`,
    }
  })

  const draft = await step('draft', 'drafted', async () => {
    const d = await deps.saveDraft(page)
    return { value: d, summary: `Draft saved as ${d.id}.` }
  })

  return { page, plan, draft, steps }
}

export const fixPage: FixPage = async (page, qa, deps) => {
  const now = deps.now ?? (() => new Date())
  const started = now()
  const r = await deps.llm.generateJson({
    system: 'You are the PageForge fixer.',
    prompt: JSON.stringify({ page, qa }),
    schema: pageSchema,
    task: 'fixer',
  })
  const changed = JSON.stringify(r.data) !== JSON.stringify(page)
  const log: StepLog = {
    step: 'fix',
    attempt: 1,
    model: r.model,
    startedAt: started.toISOString(),
    durationMs: now().getTime() - started.getTime(),
    tokens: r.tokens,
    ok: true,
    summary: changed
      ? `Patched copy for ${qa.issues.length} QA issue${qa.issues.length === 1 ? '' : 's'}.`
      : 'No content change could address the reported issues.',
  }
  await deps.onStep?.(log, 'fixing')
  return { page: r.data, steps: [log], changed }
}

/** TEMP until feat/agents merges: the real dispatcher lives in @pageforge/qa/dispatch. */
export async function dispatchQaRun(input: DispatchQaRunInput): Promise<void> {
  void input
  throw new Error('Live QA dispatch is not available in this build.')
}
