import type { Block, BlockKind, BlockProps } from '@pageforge/blocks'

/**
 * Example content for every block, written for Hoverline (a fictional
 * company). Used by Storybook, the examples test, and as reference shapes for
 * the writer agent. Every operator, person and figure here is invented.
 */

export const heroRoute: BlockProps<'hero'> = {
  _key: 'hero',
  _type: 'hero',
  variant: 'route',
  heading: 'Inspect the whole site without sending anyone up',
  subheading:
    'Hoverline drones fly the same route over your tanks, bays or benches every shift, and turn what they see into work orders before the morning meeting.',
  primaryCta: { label: 'Book a site walk-through', href: '#demo' },
  secondaryCta: { label: 'See a sample report', href: '/sample-report' },
  siteType: 'refinery',
}

export const heroStatement: BlockProps<'hero'> = {
  _key: 'hero-statement',
  _type: 'hero',
  variant: 'statement',
  heading: 'Every tank, every shift, from the air',
  subheading:
    'A docked drone flies your tank farm three times a day and flags shell hot spots, roof seal gaps and coating loss while the crew stays on the ground.',
  primaryCta: { label: 'Book a site walk-through', href: '#demo' },
  siteType: 'refinery',
}

export const heroSplit: BlockProps<'hero'> = {
  _key: 'hero-split',
  _type: 'hero',
  variant: 'split',
  heading: 'Findings your planners can act on',
  subheading:
    'Each flight ends as a list of findings with the reading, the baseline and a draft work order, sent to the system your maintenance team already uses.',
  primaryCta: { label: 'See a sample inspection report', href: '/sample-report' },
  secondaryCta: { label: 'Book a site walk-through', href: '#demo' },
  siteType: 'substation',
}

export const operatorStrip: BlockProps<'operatorStrip'> = {
  _key: 'operators',
  _type: 'operatorStrip',
  heading: 'Flying every day at refineries, utilities and mines',
  operators: [
    { name: 'Sabine Crest Refining', sector: 'Refinery, Texas' },
    { name: 'Larkspur Transmission', sector: 'Transmission utility' },
    { name: 'Coldwater Range Mining', sector: 'Iron ore, open pit' },
    { name: 'Kestrel Road Grid', sector: 'Substations, Illinois' },
    { name: 'Mesquite Point Terminals', sector: 'Tank storage' },
  ],
}

export const statsBand: BlockProps<'statsBand'> = {
  _key: 'stats',
  _type: 'statsBand',
  heading: 'What changes in the first year',
  stats: [
    {
      value: '0',
      label: 'Hours anyone spends on a rope or a lift for routine visual checks',
      basis: 'Across 2025 deployments with a docked drone',
    },
    {
      value: '6',
      unit: 'days',
      label: 'Earlier warning of a tank shell hot spot than the monthly walk-down',
      basis: 'Median across 41 confirmed findings, 2025',
    },
    {
      value: '38',
      unit: '%',
      label: 'Fewer unplanned outages on inspected transformer bays',
      basis: 'Two utilities, 12 months before and after',
    },
  ],
}

export const featureGrid: BlockProps<'featureGrid'> = {
  _key: 'platform',
  _type: 'featureGrid',
  heading: 'From flight to work order',
  intro:
    'The drone, the dock and the software are one system. Your engineers see findings, not footage.',
  siteType: 'substation',
  features: [
    {
      title: 'Routes that repeat',
      body: 'Each flight follows the same path at the same height, so today’s image lines up with last week’s and a change shows up as a change.',
    },
    {
      title: 'Thermal and visual in one pass',
      body: 'A radiometric camera reads surface temperature on every bushing, clamp and shell course while the visual camera records corrosion and damage.',
    },
    {
      title: 'Baselines per asset',
      body: 'Every reading is compared with that asset’s own history and its neighbours, so a 12 °C rise on one phase stands out against the other two.',
    },
    {
      title: 'Work orders, drafted',
      body: 'A finding above threshold becomes a draft work order with the photo, the reading and the location, ready for a planner to approve.',
    },
    {
      title: 'Flies in your weather',
      body: 'The dock holds the drone through rain and dust, and the flight waits out gusts above 12 m/s rather than skipping the shift.',
    },
    {
      title: 'Your data, your tenancy',
      body: 'Imagery and findings stay in your cloud region. Export everything at any time in open formats.',
    },
  ],
}

export const useCaseTabs: BlockProps<'useCaseTabs'> = {
  _key: 'sites',
  _type: 'useCaseTabs',
  heading: 'Where Hoverline flies',
  tabs: [
    {
      label: 'Refineries',
      siteType: 'refinery',
      heading: 'Tank farms, pipe racks and process units',
      body: 'The drone circles each tank at shell height, follows the pipe racks bent by bent, and keeps clear of the flare. Three flights a day fit between permit windows.',
      findings: [
        'Shell hot spots and cold spots by course',
        'Floating roof seal gaps and pooled water',
        'Coating loss and corrosion on rack steel',
        'Insulation damage on columns and lines',
      ],
    },
    {
      label: 'Substations',
      siteType: 'substation',
      heading: 'Bays, busbars and transformers',
      body: 'Flights stay outside safe approach distances and read every phase of every bay, so a hot joint is compared with its neighbours on the same scan.',
      findings: [
        'Hot joints and clamps, by phase',
        'Bushing and arrester temperature rise',
        'Broken strands and damaged insulators',
        'Vegetation inside the fence line',
      ],
    },
    {
      label: 'Open-pit mines',
      siteType: 'open-pit',
      heading: 'Pit walls, benches and haul roads',
      body: 'A daily survey flight measures every bench crest against the last one, so slope movement is caught in millimetres and haul roads are graded before they rut.',
      findings: [
        'Crest and toe movement between surveys',
        'Tension cracks behind the crest',
        'Water seeps on bench faces',
        'Haul road grade, potholes and windrows',
      ],
    },
  ],
}

export const howItWorks: BlockProps<'howItWorks'> = {
  _key: 'how',
  _type: 'howItWorks',
  heading: 'From site walk to first flight',
  steps: [
    {
      title: 'Site walk',
      body: 'An engineer walks the site with your safety lead, marks the assets to fly, and agrees no-fly zones around flares and live equipment.',
    },
    {
      title: 'Dock installed',
      body: 'One dock goes in near power and network, usually in a day. It charges the drone and keeps it dry between flights.',
    },
    {
      title: 'Route planned',
      body: 'The route is drawn on your site plan, checked against airspace and permits, and flown once with your team watching.',
    },
    {
      title: 'Flights every shift',
      body: 'The drone flies on schedule and sends findings to your maintenance system. Your planners approve the work orders.',
    },
  ],
}

export const caseStudy: BlockProps<'caseStudy'> = {
  _key: 'case-sabine-crest',
  _type: 'caseStudy',
  operator: 'Sabine Crest Refining',
  siteType: 'refinery',
  heading: 'Every tank flown three times a day',
  summary:
    'Sabine Crest’s Bayou Gate terminal runs 24 floating-roof tanks. Walk-downs found problems late and needed scaffold for anything above the first course. Since the dock went in, every tank is flown each shift and the maintenance team starts the day with a list, not a hunt.',
  metrics: [
    { value: '3×', label: 'Flights per day over the tank farm' },
    { value: '41', label: 'Findings turned into work orders in year one' },
    { value: '0', label: 'Scaffolds raised for routine visual checks' },
  ],
  quote: {
    text: 'The first week it found a seal gap on a tank we had walked past every day. Now the list is waiting when I get in.',
    name: 'Marisol Ortega',
    role: 'Reliability engineer, Bayou Gate terminal',
  },
  slug: 'sabine-crest-bayou-gate',
}

export const testimonial: BlockProps<'testimonial'> = {
  _key: 'quote-larkspur',
  _type: 'testimonial',
  text: 'We used to find a hot joint when it tripped. Now we see it climb over three scans, and the crew fixes it on a planned outage.',
  name: 'Dev Raman',
  role: 'Substation maintenance lead',
  operator: 'Larkspur Transmission',
}

export const comparisonTable: BlockProps<'comparisonTable'> = {
  _key: 'compare',
  _type: 'comparisonTable',
  heading: 'Compared with how it is done today',
  intro:
    'Most sites mix walk-downs, rope access and a contractor drone survey once a year. Here is how a docked drone changes each line.',
  columns: ['Hoverline', 'Walk-down', 'Rope access', 'Annual drone survey'],
  rows: [
    {
      label: 'How often each asset is checked',
      values: ['Every shift', 'Weekly', 'Yearly', 'Yearly'],
    },
    { label: 'People at height', values: ['None', 'None', '2 to 4', 'None'] },
    { label: 'Thermal readings', values: [true, false, false, true] },
    { label: 'Compared with last reading', values: [true, false, false, false] },
    { label: 'Work order drafted', values: [true, false, false, false] },
    { label: 'Needs a permit per visit', values: [false, false, true, true] },
  ],
}

export const integrations: BlockProps<'integrations'> = {
  _key: 'integrations',
  _type: 'integrations',
  heading: 'Findings go where work is planned',
  intro:
    'Hoverline writes findings and draft work orders into the systems your planners already use, and reads asset IDs from your register.',
  items: [
    { name: 'SAP PM', category: 'Maintenance' },
    { name: 'IBM Maximo', category: 'Maintenance' },
    { name: 'Infor EAM', category: 'Maintenance' },
    { name: 'AVEVA PI', category: 'Process data' },
    { name: 'Esri ArcGIS', category: 'Mapping' },
    { name: 'Bentley iTwin', category: 'Mapping' },
    { name: 'Azure AD', category: 'Sign-in' },
    { name: 'Okta', category: 'Sign-in' },
  ],
}

export const compliance: BlockProps<'compliance'> = {
  _key: 'compliance',
  _type: 'compliance',
  heading: 'Approved to fly where you work',
  items: [
    {
      name: 'FAA Part 108',
      detail:
        'Beyond-visual-line-of-sight approval for docked operations, with remote pilots on every flight.',
    },
    {
      name: 'ATEX Zone 2',
      detail: 'Docks rated for Zone 2 hazardous areas; flight paths stay out of Zone 0 and 1.',
    },
    {
      name: 'SOC 2 Type II',
      detail: 'Annual audit of how imagery and findings are stored, accessed and deleted.',
    },
    {
      name: 'NERC CIP',
      detail:
        'Substation deployments follow your CIP boundaries; the dock needs no routable link to protected assets.',
    },
  ],
}

export const faq: BlockProps<'faq'> = {
  _key: 'faq',
  _type: 'faq',
  heading: 'Questions from site teams',
  items: [
    {
      question: 'Who handles airspace approval?',
      answer:
        'We do. Hoverline files the waivers and keeps the approvals current, and a licensed remote pilot monitors every flight from our operations centre.',
    },
    {
      question: 'What happens in bad weather?',
      answer:
        'The drone waits in the dock. It flies in light rain, holds for gusts above 12 m/s, and makes up the missed shift when conditions clear.',
    },
    {
      question: 'Who owns the imagery and findings?',
      answer:
        'You do. Data stays in your cloud region, you can export it in open formats at any time, and it is deleted on request when the contract ends.',
    },
    {
      question: 'Does the drone fly over live equipment?',
      answer:
        'Routes keep the safe approach distances your site sets. Thermal readings are taken from outside those distances with a zoom lens.',
    },
    {
      question: 'How is it priced?',
      answer:
        'Per dock, per month, with flights and software included. Most sites need one dock; large tank farms and long lines sometimes need two.',
    },
  ],
}

export const ctaBand: BlockProps<'ctaBand'> = {
  _key: 'cta',
  _type: 'ctaBand',
  heading: 'Walk your site with one of our engineers',
  body: 'Bring your site plan. We will mark the route, the dock and the first month of findings you can expect, in about an hour.',
  cta: { label: 'Book a site walk-through', href: '#demo' },
}

export const demoForm: BlockProps<'demoForm'> = {
  _key: 'demo',
  _type: 'demoForm',
  heading: 'Book a site walk-through',
  body: 'Tell us about the site. An engineer who has flown one like it will reply, not a sales queue.',
  submitLabel: 'Request a walk-through',
  nextSteps: [
    'A site engineer replies within one working day',
    'A one-hour call over your site plan',
    'A route, dock position and expected findings, in writing',
  ],
}

/** One valid example per block kind (the route hero stands for `hero`). */
export const examples: { [K in BlockKind]: BlockProps<K> } = {
  hero: heroRoute,
  operatorStrip,
  statsBand,
  featureGrid,
  useCaseTabs,
  howItWorks,
  caseStudy,
  testimonial,
  comparisonTable,
  integrations,
  compliance,
  faq,
  ctaBand,
  demoForm,
}

/** Every example, including all three hero variants. */
export const allExamples: Block[] = [
  heroRoute,
  heroStatement,
  heroSplit,
  ...Object.values(examples).filter((b) => b._type !== 'hero'),
]

/**
 * A full Hoverline home page, in the order of its argument: what it is, with
 * the live plan; who already flies it; what the system does; where it flies;
 * how it starts; what it changes; proof from one site; what it replaces; a
 * second voice; how it connects; the approvals; the objections; the booking.
 * Grounds alternate paper, shade and ink down the page.
 */
export const examplePage: Block[] = [
  heroRoute,
  operatorStrip,
  featureGrid,
  useCaseTabs,
  howItWorks,
  statsBand,
  caseStudy,
  comparisonTable,
  testimonial,
  integrations,
  compliance,
  faq,
  demoForm,
]
