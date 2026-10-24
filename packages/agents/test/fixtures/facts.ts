import type { BrandFacts } from '@pageforge/content'

/**
 * Realistic Hoverline facts used by the agent tests. Kept separate from
 * packages/content so tests do not change when the site copy is edited.
 */
export const facts: BrandFacts = {
  company: {
    name: 'Hoverline',
    oneLiner: 'Autonomous drone inspection for refineries, power grids and mines.',
    disclosure:
      'Hoverline is a fictional company. This site is a portfolio project built with PageForge.',
  },
  siteTypes: {
    refinery: {
      label: 'Refinery',
      assets: ['storage tanks', 'flare stacks', 'pipe racks', 'cooling towers'],
      typicalFindings: [
        'tank shell corrosion',
        'flare tip damage',
        'insulation loss on pipe racks',
        'hot spots on heat exchangers',
      ],
      routeFacts: [
        { label: 'Typical route', value: '6.4 km' },
        { label: 'Flight time', value: '38 min' },
      ],
    },
    substation: {
      label: 'Substation',
      assets: ['transformers', 'bushings', 'busbars', 'perimeter fence'],
      typicalFindings: [
        'overheating connectors',
        'cracked insulators',
        'oil leaks at transformer gaskets',
        'fence breaches',
      ],
      routeFacts: [
        { label: 'Typical route', value: '2.1 km' },
        { label: 'Flight time', value: '14 min' },
      ],
    },
    'open-pit': {
      label: 'Open-pit mine',
      assets: ['high walls', 'haul roads', 'stockpiles', 'tailings dams'],
      typicalFindings: [
        'high-wall cracking',
        'stockpile volume change',
        'haul road ponding',
        'tailings seepage',
      ],
      routeFacts: [
        { label: 'Typical route', value: '11.8 km' },
        { label: 'Flight time', value: '52 min' },
      ],
    },
  },
  capabilities: [
    {
      id: 'cap-dock',
      title: 'Docked autonomy',
      detail:
        'The drone launches, lands and charges in a weatherproof dock on site, so no pilot travels to fly a route.',
    },
    {
      id: 'cap-thermal',
      title: 'Thermal and visual capture',
      detail:
        'Each flight records radiometric thermal and 48 MP visual imagery of every asset on the route.',
    },
    {
      id: 'cap-change',
      title: 'Change detection',
      detail:
        'Findings are compared with earlier flights so a growing defect is flagged before it becomes a shutdown.',
    },
    {
      id: 'cap-workorders',
      title: 'Findings to work orders',
      detail:
        'Confirmed findings become work orders in your maintenance system with photos and GPS position attached.',
    },
    {
      id: 'cap-remote',
      title: 'Remote operations',
      detail: 'One remote pilot supervises flights at several sites from a single control room.',
    },
  ],
  specs: [
    { id: 'spec-wind', label: 'Wind tolerance', value: '12 m/s' },
    { id: 'spec-ip', label: 'Dock rating', value: 'IP55' },
    { id: 'spec-flight', label: 'Max flight time', value: '55 min' },
  ],
  stats: [
    {
      id: 'st-downtime',
      value: '38',
      unit: '%',
      label: 'fewer unplanned shutdowns in the first year',
      basis: 'Median across 2025 refinery deployments',
    },
    {
      id: 'st-time',
      value: '4x',
      label: 'more inspection coverage per week than manual rounds',
      basis: 'Customer-reported, 12 sites',
    },
    {
      id: 'st-height',
      value: '0',
      label: 'hours of work at height for routine inspections',
      basis: 'Sites with docked autonomy',
    },
    {
      id: 'st-report',
      value: '24',
      unit: 'h',
      label: 'from flight to findings report',
      basis: 'Median turnaround in 2025',
    },
  ],
  operators: [
    { id: 'op-gulfline', name: 'Gulfline Refining', sector: 'Refining', siteType: 'refinery' },
    { id: 'op-northgate', name: 'Northgate Petrochem', sector: 'Refining', siteType: 'refinery' },
    { id: 'op-meridian', name: 'Meridian Grid', sector: 'Utilities', siteType: 'substation' },
    { id: 'op-altapower', name: 'Alta Power', sector: 'Utilities', siteType: 'substation' },
    { id: 'op-redrock', name: 'Red Rock Mining', sector: 'Mining', siteType: 'open-pit' },
    { id: 'op-kestrel', name: 'Kestrel Minerals', sector: 'Mining', siteType: 'open-pit' },
  ],
  caseStudies: [
    {
      id: 'cs-gulfline',
      slug: 'gulfline-refining',
      operator: 'Gulfline Refining',
      siteType: 'refinery',
      heading: 'Gulfline Refining found tank corrosion months before turnaround',
      summary:
        'Gulfline replaced monthly rope-access tank checks with weekly docked flights. Change detection flagged shell thinning on two crude tanks early enough to plan repairs into the next turnaround.',
      metrics: [
        { value: '38%', label: 'fewer unplanned shutdowns' },
        { value: '4x', label: 'more tank inspections per month' },
      ],
      quote: {
        text: 'We see the same tank from the same angle every week, so a change stands out.',
        name: 'Dana Ortiz',
        role: 'Reliability lead, Gulfline Refining',
      },
    },
    {
      id: 'cs-meridian',
      slug: 'meridian-grid',
      operator: 'Meridian Grid',
      siteType: 'substation',
      heading: 'Meridian Grid moved substation patrols to a control room',
      summary:
        'Meridian Grid runs thermal flights over 14 substations from one control room. Hot connectors are now found on scheduled flights instead of after a trip.',
      metrics: [
        { value: '14', label: 'substations flown from one room' },
        { value: '24h', label: 'from flight to findings report' },
      ],
    },
  ],
  testimonials: [
    {
      id: 't-ortiz',
      text: 'We see the same tank from the same angle every week, so a change stands out.',
      name: 'Dana Ortiz',
      role: 'Reliability lead',
      operator: 'Gulfline Refining',
    },
    {
      id: 't-cho',
      text: 'Our technicians stopped climbing for routine checks. They climb when a finding says they should.',
      name: 'Min-jun Cho',
      role: 'HSE manager',
      operator: 'Northgate Petrochem',
    },
  ],
  integrations: [
    { id: 'int-sap', name: 'SAP PM', category: 'Maintenance' },
    { id: 'int-maximo', name: 'IBM Maximo', category: 'Maintenance' },
    { id: 'int-pi', name: 'AVEVA PI', category: 'Historian' },
    { id: 'int-esri', name: 'Esri ArcGIS', category: 'GIS' },
    { id: 'int-teams', name: 'Microsoft Teams', category: 'Alerts' },
  ],
  compliance: [
    { id: 'co-iso', name: 'ISO 27001', detail: 'Information security management for flight data.' },
    {
      id: 'co-bvlos',
      name: 'BVLOS waivers',
      detail: 'We prepare and maintain beyond-visual-line-of-sight approvals for each site.',
    },
    {
      id: 'co-atex',
      name: 'ATEX zone planning',
      detail: 'Routes keep the drone outside classified hazardous zones.',
    },
  ],
  faqs: [
    {
      id: 'faq-airspace',
      question: 'Who handles airspace approval?',
      answer:
        'We prepare the BVLOS application and safety case for each site and keep it current as routes change.',
      tags: ['airspace', 'regulation'],
    },
    {
      id: 'faq-data',
      question: 'Who owns the inspection data?',
      answer: 'You do. Imagery and findings stay in your tenant and can be exported at any time.',
      tags: ['data'],
    },
    {
      id: 'faq-weather',
      question: 'What happens in bad weather?',
      answer:
        'The dock holds the drone when wind exceeds 12 m/s or rain is heavy, and the flight runs at the next safe window.',
      tags: ['weather'],
    },
    {
      id: 'faq-cost',
      question: 'How is Hoverline priced?',
      answer:
        'A yearly subscription per dock, including hardware, software, approvals and support.',
      tags: ['cost'],
    },
  ],
  voice: {
    do: [
      'Write for engineers: name the asset, the finding and the action.',
      'Use sentence case in headings.',
      'Put the outcome first, then how.',
    ],
    dont: ['Promise zero risk.', 'Name competitors.', 'Use exclamation marks.'],
    bannedPhrases: [
      'revolutionary',
      'cutting-edge',
      'game-changer',
      'seamless',
      'next-generation',
      'unlock',
      'world-class',
      'best-in-class',
      'leverage',
      'synergy',
    ],
  },
}
