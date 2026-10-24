import type { BlockKind } from '@pageforge/blocks'
import type {
  AccountBrief,
  CampaignGoal,
  CampaignStatus,
  CampaignType,
  ClaimKind,
  ClaimStatus,
  EventType,
  FactCategory,
  Industry,
  Role,
  SourceStatus,
  VersionOrigin,
  VersionState,
} from '@/lib/abm/types'

export const industryLabels: Record<Industry, string> = {
  ports: 'Ports',
  refineries: 'Refineries',
  'power-grids': 'Power grids',
  'open-pit-mining': 'Open-pit mining',
  solar: 'Solar',
}

export const typeLabels: Record<CampaignType, string> = {
  demo: 'Private demo page',
  campaign: 'Campaign page',
  solutions: 'Industry solutions page',
}

export const typeShort: Record<CampaignType, string> = {
  demo: 'Demo',
  campaign: 'Campaign',
  solutions: 'Solutions',
}

export const typeHelp: Record<CampaignType, string> = {
  demo: 'One account. Unguessable link, never indexed, expires.',
  campaign: 'A public link for one campaign. Not indexed unless you allow it.',
  solutions: 'The generic industry page. Indexed; the baseline account pages are compared with.',
}

export const goalLabels: Record<CampaignGoal, string> = {
  'book-meeting': 'Book a meeting',
  'download-report': 'Download a report',
  'event-invite': 'Invite to an event',
}

export const channelLabels: Record<AccountBrief['sourceChannel'], string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  'sales-sequence': 'Sales sequence',
  event: 'Event',
  paid: 'Paid',
  other: 'Other',
}

export const statusLabels: Record<CampaignStatus, string> = {
  draft: 'Draft',
  generating: 'Drafting',
  in_review: 'In review',
  approved: 'Approved',
  published: 'Live',
  paused: 'Paused',
  expired: 'Expired',
  archived: 'Archived',
}

export const roleLabels: Record<Role, string> = {
  marketer: 'Marketer',
  sales: 'Sales rep',
  reviewer: 'Reviewer',
  admin: 'Admin',
}

export const roleHelp: Record<Exclude<Role, 'admin'>, string> = {
  marketer: 'Write briefs, gather sources, generate and edit drafts, publish, pause and roll back.',
  sales: 'Read engagement on your accounts, see who booked, copy tracked links.',
  reviewer: 'Check every claim against its source, reject what is unsupported, approve versions.',
}

export const claimKindLabels: Record<ClaimKind, string> = {
  product_fact: 'Product fact',
  account_fact: 'Account fact',
  positioning: 'Positioning',
}

export const claimStatusLabels: Record<ClaimStatus, string> = {
  supported: 'Supported',
  needs_review: 'Needs review',
  rejected: 'Rejected',
}

export const versionStateLabels: Record<VersionState, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
}

export const originLabels: Record<VersionOrigin, string> = {
  ai_draft: 'AI draft',
  edit: 'Edit',
  duplicate: 'Duplicate',
  rollback: 'Rollback',
}

export const sourceStatusLabels: Record<SourceStatus, string> = {
  ok: 'Fetched',
  robots_disallowed: 'Skipped by robots.txt',
  blocked: 'Blocked',
  failed: 'Failed',
}

export const categoryLabels: Record<FactCategory, string> = {
  operations: 'Operations',
  scale: 'Scale',
  initiatives: 'Initiatives',
  challenges: 'Challenges',
  other: 'Other',
}

export const blockLabels: Record<BlockKind, string> = {
  hero: 'Hero',
  operatorStrip: 'Operators',
  statsBand: 'Stats band',
  featureGrid: 'Features',
  useCaseTabs: 'Use cases',
  howItWorks: 'How it works',
  caseStudy: 'Case study',
  testimonial: 'Testimonial',
  comparisonTable: 'Comparison',
  integrations: 'Integrations',
  compliance: 'Compliance',
  faq: 'FAQ',
  ctaBand: 'Call to action',
  demoForm: 'Closing form',
}

export const eventLabels: Record<EventType, string> = {
  page_view: 'Viewed the page',
  scroll_depth: 'Scrolled',
  cta_click: 'Clicked the call to action',
  form_start: 'Started the form',
  form_submit: 'Submitted the form',
  meeting_booked: 'Booked a meeting',
}

const singulars: Record<string, string> = {
  stats: 'stat',
  features: 'feature',
  items: 'item',
  steps: 'step',
  tabs: 'tab',
  metrics: 'metric',
  operators: 'operator',
  rows: 'row',
  columns: 'column',
  findings: 'finding',
  nextSteps: 'next step',
  values: 'value',
}

function words(camel: string): string {
  if (camel === 'primaryCta') return 'primary CTA'
  if (camel === 'secondaryCta') return 'secondary CTA'
  if (camel === 'cta') return 'CTA'
  return camel.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

/**
 * "stats[1].value" → "Stat 2 value"; "subheading" → "Subheading".
 * Used for claim fields, blockers and the block editor.
 */
export function fieldLabel(path: string): string {
  const parts = path.split('.').map((seg) => {
    const m = /^([A-Za-z]+)\[(\d+)\]$/.exec(seg)
    if (m) {
      const name = m[1]!
      return `${words(singulars[name] ?? name)} ${Number(m[2]) + 1}`
    }
    return words(seg)
  })
  const text = parts.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Zod issue path → "stats[1].value". */
export function pathToField(path: readonly PropertyKey[]): string {
  let out = ''
  for (const p of path) {
    if (typeof p === 'number') out += `[${p}]`
    else out += out ? `.${String(p)}` : String(p)
  }
  return out
}
