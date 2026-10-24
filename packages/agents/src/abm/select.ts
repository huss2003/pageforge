import { z } from 'zod'
import type { LlmClient } from '../types'
import type { AbmBrief, FactCategory, SelectedFact } from './types'

export const FACT_CATEGORIES = [
  'operations',
  'scale',
  'initiatives',
  'challenges',
  'other',
] as const

export const selectFactsOutputSchema = z.object({
  facts: z
    .array(
      z.object({
        index: z.number().int().min(0),
        category: z.enum(FACT_CATEGORIES),
      }),
    )
    .max(30),
})

export type SelectFactsOutput = z.infer<typeof selectFactsOutputSchema>

export interface SelectFactsInput {
  brief: Pick<AbmBrief, 'companyName' | 'industry' | 'painPoints' | 'targetRole'>
  /** Sentences extracted from the account's public pages, in page order. */
  sentences: string[]
  /** Max facts to keep. Default 12. */
  max?: number
}

export function selectFactsPrompt(input: SelectFactsInput) {
  const system = `You pick facts about one company from sentences on its public website, for a B2B landing page written to that company.
Return the INDEX of each useful sentence and a category. You never write or rewrite text: the sentence is quoted verbatim later.
Categories: operations (what they run and how), scale (sizes, counts, capacity), initiatives (plans, programmes, investments), challenges (problems they name), other.
Pick at most ${input.max ?? 12}. Prefer concrete sentences with numbers, named assets, named programmes and stated problems that relate to the brief. Skip slogans, navigation text, cookie notices and anything about people's private lives.
Output JSON: {"facts":[{"index":0,"category":"scale"}]}`
  const prompt = `BRIEF: ${JSON.stringify(input.brief)}
SENTENCES: ${JSON.stringify(input.sentences)}`
  return { system, prompt }
}

/**
 * Ask the model which sentences are worth citing. The model only returns
 * sentence indexes, so every stored quote is verbatim from the page.
 */
export async function selectFacts(
  llm: LlmClient,
  input: SelectFactsInput,
): Promise<{ facts: SelectedFact[]; model: string }> {
  if (input.sentences.length === 0) return { facts: [], model: 'none' }
  const { system, prompt } = selectFactsPrompt(input)
  const res = await llm.generateJson({
    system,
    prompt,
    schema: selectFactsOutputSchema,
    task: 'abm-select-facts',
    temperature: 0.2,
  })
  const seen = new Set<number>()
  const facts: SelectedFact[] = []
  for (const f of res.data.facts) {
    if (f.index >= input.sentences.length || seen.has(f.index)) continue
    seen.add(f.index)
    facts.push({ index: f.index, category: f.category as FactCategory })
    if (facts.length >= (input.max ?? 12)) break
  }
  return { facts, model: res.model }
}
