import type { RunStatus, StepName } from './engine'

export const statusLabels: Record<RunStatus, string> = {
  queued: 'Queued',
  planning: 'Planning sections',
  writing: 'Writing copy',
  validating: 'Checking the schema',
  drafted: 'Draft saved',
  'qa-running': 'Running QA',
  fixing: 'Fixing QA issues',
  ready: 'Ready to publish',
  published: 'Published',
  failed: 'Failed',
}

export const stepLabels: Record<StepName, string> = {
  plan: 'Plan',
  write: 'Write',
  validate: 'Validate',
  draft: 'Save draft',
  qa: 'QA',
  fix: 'Fix',
  publish: 'Publish',
}

export const scoreLabels = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  seo: 'SEO',
  bestPractices: 'Best practices',
} as const

export const blockTitles: Record<string, string> = {
  hero: 'Hero',
  operatorStrip: 'Operators',
  statsBand: 'Stats band',
  featureGrid: 'Capabilities',
  useCaseTabs: 'Use cases',
  howItWorks: 'How it works',
  caseStudy: 'Case study',
  testimonial: 'Testimonial',
  comparisonTable: 'Comparison',
  integrations: 'Integrations',
  compliance: 'Compliance',
  faq: 'FAQ',
  ctaBand: 'Call to action',
  demoForm: 'Demo form',
}

export const runningStatuses: RunStatus[] = [
  'queued',
  'planning',
  'writing',
  'validating',
  'drafted',
  'qa-running',
  'fixing',
]
