import type { Brief } from './engine'

/** Labels and sample briefs shared by the form (client) and the server. No zod here. */
export const siteTypeLabels = {
  refinery: 'Refinery',
  substation: 'Substation',
  'open-pit': 'Open-pit mine',
} as const

export const goalLabels = {
  'book-demo': 'Book a demo',
  'download-report': 'Download a report',
  'contact-sales': 'Contact sales',
} as const

export const audienceSuggestions = [
  'Operations manager',
  'HSE lead',
  'Reliability engineer',
  'Procurement',
]

export const exampleBriefs: Brief[] = [
  {
    prospect: 'Gulf Coast refinery running rope-access tank inspections twice a year',
    siteType: 'refinery',
    audience: ['Reliability engineer', 'HSE lead'],
    goal: 'book-demo',
    notes:
      'Their last turnaround slipped 9 days after corrosion on a crude tank roof was found late. The reliability lead asked whether flights can run during operations and how findings reach SAP.',
  },
  {
    prospect: 'Regional utility with 140 unmanned substations across two states',
    siteType: 'substation',
    audience: ['Operations manager', 'Procurement'],
    goal: 'contact-sales',
    notes:
      'Thermal checks are done by a contractor once a quarter. Procurement wants per-site pricing and wants to know who owns the imagery.',
  },
  {
    prospect: 'Copper open-pit mine expanding its east wall',
    siteType: 'open-pit',
    audience: ['HSE lead', 'Operations manager'],
    goal: 'download-report',
    notes:
      'Geotech team surveys the wall weekly by hand. They had a near miss on a haul road last spring and want daily slope monitoring.',
  },
]
