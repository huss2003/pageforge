import type { Page } from '@pageforge/blocks'
import type { Brief, PipelineDeps, RunStatus, StepLog } from '../src'
import { FakeLlm, composeForTests } from './compose-bridge'
import { facts } from './fixtures/facts'

export const refineryBrief: Brief = {
  prospect: 'Tier-1 refinery operator on the Gulf coast',
  siteType: 'refinery',
  audience: ['Reliability engineers', 'HSE managers'],
  goal: 'book-demo',
  notes: 'They use rope access for tank inspections and worry about unplanned downtime.',
}

export const substationBrief: Brief = {
  prospect: 'Regional utility with 40 substations',
  siteType: 'substation',
  audience: ['Asset managers', 'Maintenance planners'],
  goal: 'contact-sales',
}

/** A valid page for the refinery brief, built by the offline composer. */
export function goodPage(brief: Brief = refineryBrief): Page {
  return composeForTests(brief)
}

export function clone<T>(v: T): T {
  return structuredClone(v)
}

export function fakeDeps(llm = new FakeLlm(facts)) {
  const events: { log: StepLog; status: RunStatus }[] = []
  const saved: Page[] = []
  const deps: PipelineDeps = {
    llm,
    facts,
    saveDraft: async (page) => {
      saved.push(page)
      return { id: `drafts.${page.slug}`, previewUrl: `https://example.test/preview/${page.slug}` }
    },
    onStep: (log, status) => {
      events.push({ log, status })
    },
    now: (() => {
      let t = Date.parse('2026-10-24T10:00:00Z')
      return () => new Date((t += 250))
    })(),
  }
  return { deps, events, saved, llm }
}

export { facts }
