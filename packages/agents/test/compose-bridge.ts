import type { Page } from '@pageforge/blocks'
import { FakeLlm } from '../src'
import { composePage, composePlan } from '../src/llm/compose'
import { normalizePlan } from '../src/planner'
import { finalizePage } from '../src/writer'
import type { Brief } from '../src'
import { facts } from './fixtures/facts'

export { FakeLlm }

export function composeForTests(brief: Brief): Page {
  const { plan } = normalizePlan(composePlan(brief, facts), brief, facts)
  return finalizePage(composePage(brief, plan, facts), brief, plan)
}
