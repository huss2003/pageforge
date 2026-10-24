import type { CampaignDetail, Role } from '@/lib/abm/types'

export const steps = [
  { id: 'brief', label: 'Brief' },
  { id: 'sources', label: 'Sources' },
  { id: 'draft', label: 'Draft' },
  { id: 'review', label: 'Review' },
  { id: 'publish', label: 'Publish' },
  { id: 'engagement', label: 'Engagement' },
] as const

export type StepId = (typeof steps)[number]['id']

export function isStep(s: string): s is StepId {
  return steps.some((x) => x.id === s)
}

/** Where a campaign opens: the next thing someone has to do, for this role. */
export function defaultStep(c: Pick<CampaignDetail, 'status' | 'current'>, role: Role): StepId {
  if (role === 'sales') {
    return c.status === 'published' || c.status === 'paused' || c.status === 'expired'
      ? 'engagement'
      : 'brief'
  }
  switch (c.status) {
    case 'draft':
    case 'generating':
      return 'sources'
    case 'in_review':
      return role === 'reviewer' || c.current?.state === 'in_review' ? 'review' : 'draft'
    case 'approved':
      return 'publish'
    case 'published':
    case 'paused':
    case 'expired':
      return role === 'reviewer' ? 'review' : 'engagement'
    default:
      return 'brief'
  }
}

/** Which steps are finished, for the marks on the step bar. */
export function doneSteps(
  c: Pick<CampaignDetail, 'status' | 'current' | 'facts' | 'type' | 'publishedVersionId'>,
): Set<StepId> {
  const done = new Set<StepId>(['brief'])
  if (c.facts.length > 0 || c.type === 'solutions' || c.current) done.add('sources')
  if (c.current) done.add('draft')
  if (c.current?.state === 'approved' || c.publishedVersionId) done.add('review')
  if (c.publishedVersionId) done.add('publish')
  return done
}
