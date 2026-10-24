import { registry, type Block, type BlockKind } from '@pageforge/blocks'
import type { BrandFacts } from '@pageforge/content'
import { factDetail, factIndex } from '../facts'
import { GOAL_CTAS, closingKind } from '../goals'
import type { Brief, PagePlan } from '../types'
import { blockShapes } from './shapes'

/**
 * Prompt builders. Prompts are deliberately terse: the free tiers we run on
 * have small per-minute token budgets, and the zod schemas (sent as the
 * response schema to Gemini) already carry the structure.
 *
 * Tagged JSON lines (BRIEF:, PLAN:, BLOCKS:) are machine-readable so the
 * offline FakeLlm can answer the same prompts deterministically.
 */

export interface Prompt {
  system: string
  prompt: string
}

const json = (v: unknown) => JSON.stringify(v)

function catalogue(): string {
  return Object.values(registry)
    .map(
      (d) =>
        `- ${d.kind} | max ${d.maxPerPage}${d.placement && d.placement !== 'any' ? ` | ${d.placement}` : ''} | ${d.aiUsage}`,
    )
    .join('\n')
}

function voice(facts: BrandFacts): string {
  const v = facts.voice
  return [
    v.do.length ? `Do: ${v.do.join(' ')}` : '',
    v.dont.length ? `Don't: ${v.dont.join(' ')}` : '',
    v.bannedPhrases.length
      ? `Banned words (never use, any case): ${v.bannedPhrases.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function briefLine(brief: Brief): string {
  return `BRIEF: ${json(brief)}`
}

export function plannerPrompt(brief: Brief, facts: BrandFacts): Prompt {
  const closing = closingKind(brief.goal)
  const system = `You plan one B2B landing page for ${facts.company.name} (${facts.company.oneLiner}) aimed at a single prospect.
Pick blocks from CATALOGUE in reading order.
Rules:
- 5 to 9 sections. First is hero. Last is ${closing === 'demoForm' ? 'demoForm (goal is book-demo)' : 'ctaBand'}; never use ${closing === 'demoForm' ? 'ctaBand' : 'demoForm'}.
- Respect each block's max. Add a block only when its note fits the brief.
- factIds: ids from FACTS the section will use. Only ids that exist.
- angle: the prospect's main problem in one line, ≤120 chars, using the site's typical findings.
- title: sentence case, ≤90 chars. slug: lowercase-hyphenated, ≤60 chars, names the prospect and site.
- purpose: one short line per section saying what it must prove to this audience.
Output JSON: {"title","slug","angle","sections":[{"kind","purpose","factIds":[]}]}

CATALOGUE (kind | max | placement | when to use):
${catalogue()}`

  const prompt = `${briefLine(brief)}

FACTS:
${factIndex(facts, brief.siteType)}`
  return { system, prompt }
}

export function writerSystem(facts: BrandFacts): string {
  return `You write landing page copy for ${facts.company.name} as one JSON Page object.
Copy rules:
- Every number, operator, customer, quote, metric, integration and certification comes from FACTS, copied exactly. Write no other numbers.
- statsBand: value/unit/label/basis copied from a FACTS stat. caseStudy: operator, siteType, metrics and quote copied from one FACTS case study (slug too). testimonial: copied from FACTS. operatorStrip, integrations, compliance: names from FACTS.
- Specific and concrete: name the prospect's assets, findings and audience. No hype, no exclamation marks.
- Sentence case for every heading and label.
- CTA labels say what happens next. Use the GOAL CTA exactly for primary CTAs.
- Respect every max length (≤N chars). Short beats long.
${voice(facts)}
Page shape: {"kind":"landing","title":str≤90,"slug":str,"seo":{"title":str 30-60,"description":str 80-160,"noindex":true},"blocks":[{"_key":"b1","_type":kind,...fields}]}
_key: short unique ids b1, b2, ... in order. Blocks follow PLAN order exactly.`
}

export function writerPrompt(brief: Brief, plan: PagePlan, facts: BrandFacts): Prompt {
  const kinds = plan.sections.map((s) => s.kind)
  const cta = GOAL_CTAS[brief.goal]
  const prompt = `${briefLine(brief)}
PLAN: ${json(plan)}
GOAL CTA: {"label":${json(cta.label)},"href":${json(cta.href)}}
hero.siteType: "${brief.siteType}"

BLOCK FIELDS (str≤N = max chars, ? = optional, (a-b) = item count):
${blockShapes(kinds)}

FACTS:
${factDetail(facts, { siteType: brief.siteType, kinds, cited: plan.sections.flatMap((s) => s.factIds) })}`
  return { system: writerSystem(facts), prompt }
}

/**
 * Retry prompt: only the failing parts of the page plus the validator's
 * errors. The model returns just the corrected blocks (same _key).
 */
export function writerRetryPrompt(
  brief: Brief,
  plan: PagePlan,
  facts: BrandFacts,
  page: { title: string; seo: unknown; blocks: Block[] },
  errors: string[],
  failingKeys: string[],
): Prompt {
  const failing = page.blocks.filter((b) => failingKeys.includes(b._key))
  const kinds = failing.map((b) => b._type)
  const prompt = `${briefLine(brief)}
PLAN: ${json({ title: plan.title, angle: plan.angle })}
GOAL CTA: ${json({ label: GOAL_CTAS[brief.goal].label, href: GOAL_CTAS[brief.goal].href })}
The page failed validation. Fix ONLY these errors:
${errors.map((e) => `- ${e}`).join('\n')}

PAGE: ${json({ title: page.title, seo: page.seo })}
BLOCKS: ${json(failing)}

BLOCK FIELDS:
${blockShapes(kinds.length ? kinds : (['hero'] as BlockKind[]))}

FACTS:
${factDetail(facts, { siteType: brief.siteType, kinds, cited: plan.sections.flatMap((s) => s.factIds) })}

Return {"title","seo","blocks":[...]} where blocks holds only the corrected blocks, each with its original _key and _type.`
  return { system: writerSystem(facts), prompt }
}

export function fixerPrompt(
  facts: BrandFacts,
  ctx: { goal?: Brief['goal']; siteType: string },
  blocks: Block[],
  issues: string[],
): Prompt {
  const system = `You fix content problems found by automated QA on a ${facts.company.name} landing page.
Change as little as possible. Keep each block's _key and _type. Keep every fact (numbers, names, quotes) exactly as it is.
Typical fixes: shorten long headings and paragraphs, make link labels say what happens next, remove banned words.
${voice(facts)}
Respect every max length. Return {"blocks":[...]} with the corrected blocks only.`
  const kinds = [...new Set(blocks.map((b) => b._type))]
  const prompt = `CONTEXT: ${json(ctx)}${ctx.goal ? `\nGOAL CTA: ${json({ label: GOAL_CTAS[ctx.goal].label, href: GOAL_CTAS[ctx.goal].href })}` : ''}
ISSUES:
${issues.map((i) => `- ${i}`).join('\n')}

BLOCKS: ${json(blocks)}

BLOCK FIELDS:
${blockShapes(kinds)}`
  return { system, prompt }
}
