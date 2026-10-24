import type { BlockProps, Page, PageKind } from '@pageforge/blocks'
import {
  allOperators,
  caseStudy,
  caseStudyFact,
  compliance,
  faqs,
  features,
  integrations,
  operators,
  operatorsFor,
  stats,
  testimonial,
} from './select'

/**
 * Seed pages for the Hoverline site.
 *
 * Used when Sanity is not configured, as the fallback when a CMS page is
 * missing or invalid, and as the content `pnpm seed:sanity` uploads.
 * Every claim is pulled from `facts` through the selectors in ./select.
 */

const bookDemo = { label: 'Book a demo', href: '/book-a-demo' }

const comparisonRows: BlockProps<'comparisonTable'>['rows'] = [
  {
    label: 'How often each asset is checked',
    values: ['On a schedule you set', 'Quarterly at best', 'Monthly', 'When a crew is booked'],
  },
  { label: 'People working at height', values: [false, true, false, false] },
  {
    label: 'Thermal reading on every pass',
    values: [true, false, true, 'If the payload is fitted'],
  },
  { label: 'Same angles every time, for comparison', values: [true, false, false, false] },
  {
    label: 'Findings raised as work orders',
    values: [
      'After inspector review',
      'Typed up from notes',
      'Typed up from a report',
      'Typed up from a report',
    ],
  },
  {
    label: 'Response after a gas or fire alarm',
    values: ['Median 4 min', 'Not possible', 'Not possible', 'Hours to arrange'],
  },
]

const comparisonColumns = [
  'Hoverline',
  'Rope access',
  'Thermography rounds',
  'Piloted drone survey',
]

const deploymentSteps: BlockProps<'howItWorks'>['steps'] = [
  {
    title: 'Survey and dock install',
    body: 'We survey the site with your safety team, choose a dock location outside classified zones and install it on a 2 × 2 m pad with power and a network connection.',
  },
  {
    title: 'Routes drawn with your inspectors',
    body: 'Your inspectors mark the assets that matter on the site plan. We turn them into a route with fixed waypoints, camera angles and no-fly zones.',
  },
  {
    title: 'Scheduled flights',
    body: 'The drone flies the route on your schedule, beyond visual line of sight, watched by a certified remote pilot. It holds in the dock when the weather is outside limits.',
  },
  {
    title: 'Review, then work order',
    body: 'Changes since the last flight go to your inspector’s queue. Confirmed findings are raised in your maintenance system with images and a suggested priority.',
  },
]

const home: Page = {
  kind: 'home',
  title: 'Hoverline',
  slug: 'home',
  seo: {
    title: 'Autonomous drone inspection for industrial sites',
    description:
      'Dock-based drones fly scheduled inspection routes over refineries, substations and open-pit mines and send confirmed findings to your maintenance system.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'route',
      heading: 'Inspect the whole site from the dock',
      subheading:
        'Hoverline drones live on site and fly the same route over tanks, substations and pit walls on a schedule. Your inspector confirms what changed, and it becomes a work order.',
      primaryCta: bookDemo,
      secondaryCta: { label: 'See the platform', href: '/platform' },
      siteType: 'refinery',
    },
    {
      _key: 'operators',
      _type: 'operatorStrip',
      heading: 'Flying at refineries, utilities and mines',
      operators: allOperators(),
    },
    {
      _key: 'sites',
      _type: 'useCaseTabs',
      heading: 'Where Hoverline flies',
      tabs: [
        {
          label: 'Refineries',
          siteType: 'refinery',
          heading: 'Tank farms, flares and pipe racks',
          body: 'One dock covers a 6.8 km route over tanks, flare stacks and pipe racks in 31 minutes. Thermal and zoom images of the same 140 assets come back every 12 hours.',
          findings: [
            'Hot spot on an insulated line at a pipe-rack support',
            'Gap in a floating-roof rim seal',
            'Burner damage on a flare tip',
          ],
        },
        {
          label: 'Substations',
          siteType: 'substation',
          heading: 'Every connection in the yard, daily',
          body: 'A 14-minute flight reads 310 components across transformers, breakers and busbars, keeping the minimum approach distance for each voltage class. Storms trigger an extra flight.',
          findings: [
            'Hot connector on a disconnect switch',
            'Temperature imbalance across transformer bushings',
            'Vegetation inside the line clearance zone',
          ],
        },
        {
          label: 'Open-pit mines',
          siteType: 'open-pit',
          heading: 'Pit walls and haul roads before first shift',
          body: 'A LiDAR survey of 3.2 km² finishes before the pre-shift meeting and is compared with the last 30 days, so slope movement and low berms are on the shift boss’s map.',
          findings: [
            'Slope movement above the alert threshold',
            'Tension crack behind a bench crest',
            'Haul-road berm below half wheel height',
          ],
        },
      ],
    },
    {
      _key: 'stats',
      _type: 'statsBand',
      heading: 'What changes after a year of flights',
      stats: stats('inspection-hours', 'detection-lead', 'flight-completion', 'response-time'),
    },
    {
      _key: 'how',
      _type: 'howItWorks',
      heading: 'From dock install to work order',
      steps: deploymentSteps,
    },
    caseStudy('calder-bay-tank-farm', { key: 'case-calder-bay' }),
    testimonial('larkspur-storms', 'quote-larkspur'),
    {
      _key: 'integrations',
      _type: 'integrations',
      heading: 'Findings go where your planners work',
      intro:
        'Confirmed findings are raised as work orders with the asset ID, location and images. Alerts reach the control room in the tools it already uses.',
      items: integrations('sap-pm', 'maximo', 'infor-eam', 'servicenow', 'arcgis', 'teams'),
    },
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Questions operators ask first',
      items: faqs('airspace', 'weather', 'data-ownership', 'pilots', 'pricing'),
    },
    {
      _key: 'cta',
      _type: 'ctaBand',
      heading: 'See a flight over a site like yours',
      body: 'Tell us what you run. We will walk you through a recorded flight over similar assets and the findings it raised.',
      cta: bookDemo,
    },
  ],
}

const platform: Page = {
  kind: 'platform',
  title: 'Platform',
  slug: 'platform',
  seo: {
    title: 'Platform: drone, dock and review queue',
    description:
      'How Hoverline works: a weatherproof dock, thermal, zoom and LiDAR payloads, scheduled BVLOS routes, change detection and findings raised in your CMMS.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'split',
      heading: 'The drone, the dock and the review queue',
      subheading:
        'A drone that lives on site, a camera payload for each kind of finding, and software that shows your inspector only what changed since the last flight.',
      primaryCta: bookDemo,
      secondaryCta: { label: 'Industries', href: '/industries' },
      siteType: 'refinery',
    },
    {
      _key: 'capabilities',
      _type: 'featureGrid',
      heading: 'What each flight does',
      intro:
        'The same hardware flies at refineries, substations and mines. What changes is the route, the payload settings and the thresholds your team sets.',
      features: features(
        'dock',
        'scheduled-routes',
        'thermal',
        'zoom',
        'lidar',
        'change-detection',
      ),
    },
    {
      _key: 'how',
      _type: 'howItWorks',
      heading: 'How a site goes live',
      steps: deploymentSteps,
    },
    {
      _key: 'compare',
      _type: 'comparisonTable',
      heading: 'Compared with how sites inspect today',
      intro:
        'Methods, not vendors. Most sites keep rope access for repairs and use flights to decide where it goes.',
      columns: comparisonColumns,
      rows: comparisonRows,
    },
    {
      _key: 'stats',
      _type: 'statsBand',
      stats: stats('permits-avoided', 'detection-lead', 'slope-resolution'),
    },
    {
      _key: 'integrations',
      _type: 'integrations',
      heading: 'Connects to the systems you run',
      intro: 'Work orders, alerts, maps and sign-on use the tools your teams already have.',
      items: integrations(),
    },
    {
      _key: 'compliance',
      _type: 'compliance',
      heading: 'Security and flight approvals',
      items: compliance(),
    },
    testimonial('harwick-terminals', 'quote-harwick'),
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Platform questions',
      items: faqs('data-ownership', 'security', 'cmms', 'false-positives', 'pilots', 'install'),
    },
    {
      _key: 'cta',
      _type: 'ctaBand',
      heading: 'Walk through a live site',
      body: 'We will show you the route editor, a recorded flight and the review queue for a site like yours.',
      cta: bookDemo,
    },
  ],
}

const bookADemo: Page = {
  kind: 'page',
  title: 'Book a demo',
  slug: 'book-a-demo',
  seo: {
    title: 'Book a demo',
    description:
      'See a recorded Hoverline flight over a refinery, substation or open-pit mine like yours, and get a site survey and quote.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'statement',
      heading: 'See a flight over a site like yours',
      subheading:
        'A 30-minute call with an engineer who has deployed docks at your kind of site. You will see a recorded flight, the findings it raised and what installation would involve.',
      primaryCta: { label: 'Request a demo', href: '#demo-form' },
      secondaryCta: { label: 'Read case studies', href: '/case-studies' },
      siteType: 'substation',
    },
    {
      _key: 'operators',
      _type: 'operatorStrip',
      operators: operators(
        'calder-bay',
        'northvale',
        'sorrel-ridge',
        'harwick-point',
        'larkspur',
        'brannock',
      ),
    },
    testimonial('tessmer-safety', 'quote-tessmer'),
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Before you book',
      items: faqs('pricing', 'install', 'airspace', 'pilots'),
    },
    {
      _key: 'demo-form',
      _type: 'demoForm',
      heading: 'Request a demo',
      body: 'Tell us about your site. An engineer replies within one business day to set a time.',
      submitLabel: 'Book a demo',
      nextSteps: [
        'An engineer who has worked on your kind of site replies within one business day.',
        'On the call you see a recorded flight over similar assets and the findings it raised.',
        'If it fits, we arrange a site survey and send a quote based on your routes.',
      ],
    },
  ],
}

const refineries: Page = {
  kind: 'industry',
  title: 'Refineries and terminals',
  slug: 'refineries',
  seo: {
    title: 'Drone inspection for refineries and terminals',
    description:
      'Scheduled thermal and zoom flights over tank farms, flare stacks and pipe racks, with confirmed findings raised in SAP PM or Maximo.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'route',
      heading: 'Tank farms and flares, checked twice a day',
      subheading:
        'One dock flies a 6.8 km route over tanks, flare stacks and pipe racks every 12 hours. Hot spots, seal gaps and corrosion signs reach your inspector with images attached.',
      primaryCta: bookDemo,
      secondaryCta: {
        label: 'Calder Bay case study',
        href: '/case-studies/calder-bay-refining-tank-farm',
      },
      siteType: 'refinery',
    },
    {
      _key: 'operators',
      _type: 'operatorStrip',
      heading: 'Refining and terminal operators',
      operators: operatorsFor('refinery'),
    },
    {
      _key: 'areas',
      _type: 'useCaseTabs',
      heading: 'What the refinery route covers',
      tabs: [
        {
          label: 'Tank farm',
          siteType: 'refinery',
          heading: 'Shells, roofs and bunds',
          body: 'Zoom images of every shell course and roof, and thermal passes over floating-roof seals. Bunds are checked for sheen and standing product after rain.',
          findings: [
            'Corrosion-under-insulation signs on a tank shell',
            'Gap in a floating-roof rim seal',
            'Hydrocarbon sheen inside a tank bund',
          ],
        },
        {
          label: 'Flares',
          siteType: 'refinery',
          heading: 'Flare tips without a shutdown',
          body: 'The zoom camera reads the tip from a 40 m standoff while the flare is live. Geofences keep the drone clear of the heat plume.',
          findings: [
            'Burner damage on a flare tip',
            'Hot spot on an insulated line at a pipe-rack support',
          ],
        },
        {
          label: 'Pipe racks',
          siteType: 'refinery',
          heading: 'Insulated lines and supports',
          body: 'Thermal passes along each rack flag warm spots at supports, where water gets under insulation first.',
          findings: [
            'Hot spot on an insulated line at a pipe-rack support',
            'Corrosion-under-insulation signs on a tank shell',
          ],
        },
      ],
    },
    {
      _key: 'capabilities',
      _type: 'featureGrid',
      heading: 'Built around your inspection plan',
      features: features('thermal', 'zoom', 'change-detection', 'work-orders', 'on-demand'),
    },
    caseStudy('calder-bay-tank-farm', { key: 'case-calder-bay' }),
    {
      _key: 'compare',
      _type: 'comparisonTable',
      heading: 'Compared with rope access and rounds',
      columns: comparisonColumns,
      rows: comparisonRows,
    },
    {
      _key: 'compliance',
      _type: 'compliance',
      heading: 'Approvals and security',
      items: compliance('bvlos-waivers', 'soc2', 'iso27001', 'data-residency'),
    },
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Refinery questions',
      items: faqs('hazardous-areas', 'airspace', 'weather', 'cmms'),
    },
    {
      _key: 'cta',
      _type: 'ctaBand',
      heading: 'Plan a route over your tank farm',
      body: 'Send us a site plan and we will show you the route, the flight time and what each pass would record.',
      cta: bookDemo,
    },
  ],
}

const powerGrids: Page = {
  kind: 'industry',
  title: 'Power grids and substations',
  slug: 'power-grids',
  seo: {
    title: 'Drone inspection for substations and power grids',
    description:
      'Daily thermal flights over substation yards and storm flights on demand, keeping minimum approach distances with no outage needed.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'route',
      heading: 'Every substation yard, flown every day',
      subheading:
        'A 14-minute flight reads 310 components across transformers, breakers and busbars. Hot connections are found in the first week, not at the next twice-yearly round.',
      primaryCta: bookDemo,
      secondaryCta: {
        label: 'Northvale case study',
        href: '/case-studies/northvale-transmission-substations',
      },
      siteType: 'substation',
    },
    {
      _key: 'stats',
      _type: 'statsBand',
      stats: stats('detection-lead', 'response-time', 'permits-avoided'),
    },
    {
      _key: 'capabilities',
      _type: 'featureGrid',
      heading: 'Made for energised yards',
      features: features('thermal', 'zoom', 'on-demand', 'geofencing', 'bvlos'),
    },
    caseStudy('northvale-substations', { key: 'case-northvale' }),
    testimonial('larkspur-storms', 'quote-larkspur'),
    {
      _key: 'compliance',
      _type: 'compliance',
      heading: 'Kept apart from protection and control',
      items: compliance('nerc-cip', 'soc2', 'iso27001', 'bvlos-waivers'),
    },
    {
      _key: 'integrations',
      _type: 'integrations',
      heading: 'Into your work management and GIS',
      items: integrations('sap-pm', 'maximo', 'servicenow', 'arcgis', 'aveva-pi', 'teams'),
    },
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Utility questions',
      items: faqs('substation-clearance', 'airspace', 'security', 'pilots'),
    },
    {
      _key: 'cta',
      _type: 'ctaBand',
      heading: 'Cover more yards with fewer trips',
      body: 'Tell us how many substations you run and how far apart they are. We will show you how many docks it takes.',
      cta: bookDemo,
    },
  ],
}

const openPitMining: Page = {
  kind: 'industry',
  title: 'Open-pit mining',
  slug: 'open-pit-mining',
  seo: {
    title: 'Drone slope monitoring for open-pit mines',
    description:
      'Daily LiDAR surveys of pit walls, haul roads and tailings embankments to ±8 mm, finished before the first shift starts.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'route',
      heading: 'Pit walls surveyed before first shift',
      subheading:
        'A dock on the pit rim flies an 8.9 km LiDAR route every morning and compares each wall with the last 30 days. Movement and low berms are on the map before anyone drives in.',
      primaryCta: bookDemo,
      secondaryCta: {
        label: 'Sorrel Ridge case study',
        href: '/case-studies/sorrel-ridge-copper-pit-walls',
      },
      siteType: 'open-pit',
    },
    {
      _key: 'operators',
      _type: 'operatorStrip',
      heading: 'Mines and quarries flying daily',
      operators: operatorsFor('open-pit'),
    },
    {
      _key: 'areas',
      _type: 'useCaseTabs',
      heading: 'What the morning flight covers',
      tabs: [
        {
          label: 'Pit walls',
          siteType: 'open-pit',
          heading: 'Benches, crests and slope movement',
          body: 'Repeat LiDAR measures every wall to ±8 mm. Movement above your alert threshold goes straight to the geotechnical team with a heat map of the change.',
          findings: [
            'Slope movement above the alert threshold',
            'Tension crack behind a bench crest',
          ],
        },
        {
          label: 'Haul roads',
          siteType: 'open-pit',
          heading: 'Berm heights on every section',
          body: 'Safety berms are measured against the wheel height of the largest truck on the road. Low sections are flagged with their chainage.',
          findings: [
            'Haul-road berm below half wheel height',
            'Tension crack behind a bench crest',
          ],
        },
        {
          label: 'Tailings and plant',
          siteType: 'open-pit',
          heading: 'Embankments, stockpiles and conveyors',
          body: 'Thermal passes catch seepage on embankments and hot idlers on conveyors. Stockpile volumes come from the same survey.',
          findings: ['Seepage on a tailings embankment', 'Conveyor idler running hot'],
        },
      ],
    },
    {
      _key: 'stats',
      _type: 'statsBand',
      heading: 'Survey numbers',
      stats: stats('slope-resolution', 'flight-completion', 'inspection-hours'),
    },
    caseStudy('sorrel-ridge-pit-walls', { key: 'case-sorrel-ridge' }),
    testimonial('brannock-haul-roads', 'quote-brannock'),
    {
      _key: 'how',
      _type: 'howItWorks',
      heading: 'How a mine goes live',
      steps: deploymentSteps,
    },
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Mining questions',
      items: faqs('slope-monitoring', 'weather', 'install', 'data-ownership'),
    },
    {
      _key: 'cta',
      _type: 'ctaBand',
      heading: 'Map your pit walls every morning',
      body: 'Send us a pit outline and we will show you the route, the survey area and when the data would be ready.',
      cta: bookDemo,
    },
  ],
}

const calderBay = caseStudyFact('calder-bay-tank-farm')
const northvale = caseStudyFact('northvale-substations')
const sorrelRidge = caseStudyFact('sorrel-ridge-pit-walls')
const allCaseStudies = { label: 'All case studies', href: '/case-studies' }

const calderBayPage: Page = {
  kind: 'caseStudy',
  title: `${calderBay.operator}: tank farm and flares`,
  slug: calderBay.slug,
  seo: {
    title: 'Calder Bay Refining: tank farm inspection',
    description:
      'Calder Bay Refining cut rope-access hours on its tank farm by 64% with two Hoverline flights a day over 46 tanks and two flares.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'statement',
      heading: 'Two flights a day over 46 tanks',
      subheading:
        'How Calder Bay Refining moved routine tank and flare checks from rope access to a dock-based drone, and planned its turnaround around what the flights found.',
      primaryCta: bookDemo,
      secondaryCta: allCaseStudies,
      siteType: 'refinery',
    },
    caseStudy(calderBay.id, { key: 'case', link: false }),
    {
      _key: 'how',
      _type: 'howItWorks',
      heading: 'How the site went live',
      steps: deploymentSteps,
    },
    testimonial('tessmer-safety', 'quote-tessmer'),
    {
      _key: 'cta',
      _type: 'ctaBand',
      heading: 'Run the same route at your refinery',
      cta: bookDemo,
    },
  ],
}

const northvalePage: Page = {
  kind: 'caseStudy',
  title: `${northvale.operator}: 12 substations`,
  slug: northvale.slug,
  seo: {
    title: 'Northvale Transmission: substation inspection',
    description:
      'Four Hoverline docks fly daily over 12 Northvale Transmission substations and found 31 hot connections in the first quarter.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'statement',
      heading: '31 hot connections in one quarter',
      subheading:
        'How Northvale Transmission replaced twice-yearly handheld thermography at 12 rural substations with daily flights from four docks.',
      primaryCta: bookDemo,
      secondaryCta: allCaseStudies,
      siteType: 'substation',
    },
    caseStudy(northvale.id, { key: 'case', link: false }),
    {
      _key: 'capabilities',
      _type: 'featureGrid',
      heading: 'What made it work',
      features: features('thermal', 'zoom', 'on-demand'),
    },
    testimonial('larkspur-storms', 'quote-larkspur'),
    {
      _key: 'cta',
      _type: 'ctaBand',
      heading: 'Fly your substations every day',
      cta: bookDemo,
    },
  ],
}

const sorrelRidgePage: Page = {
  kind: 'caseStudy',
  title: `${sorrelRidge.operator}: pit-wall monitoring`,
  slug: sorrelRidge.slug,
  seo: {
    title: 'Sorrel Ridge Copper: pit-wall monitoring',
    description:
      'Daily LiDAR flights at Sorrel Ridge Copper gave the geotechnical team 41 hours of warning before a bench crest failed on the east wall.',
    noindex: false,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'statement',
      heading: '41 hours of warning on the east wall',
      subheading:
        'How Sorrel Ridge Copper replaced weekly walk-over slope surveys with a LiDAR flight over all four walls before every first shift.',
      primaryCta: bookDemo,
      secondaryCta: allCaseStudies,
      siteType: 'open-pit',
    },
    caseStudy(sorrelRidge.id, { key: 'case', link: false }),
    {
      _key: 'stats',
      _type: 'statsBand',
      stats: stats('slope-resolution', 'flight-completion'),
    },
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Questions from geotechnical teams',
      items: faqs('slope-monitoring', 'weather', 'install'),
    },
    {
      _key: 'cta',
      _type: 'ctaBand',
      heading: 'Survey your pit walls daily',
      cta: bookDemo,
    },
  ],
}

/**
 * An example of what the Factory produces from a brief:
 *   prospect: "Coastal refinery with a 40-tank farm, rope access today"
 *   audience: inspection superintendent, maintenance planner
 *   goal:     book-demo
 * Not indexed; shows the shape of a generated campaign page.
 */
const exampleLanding: Page = {
  kind: 'landing',
  title: 'Tank inspection without rope access',
  slug: 'example-refinery-tank-inspection',
  seo: {
    title: 'Tank inspection without rope access',
    description:
      'Scheduled drone flights over your tank farm, with confirmed findings raised as work orders in SAP PM or Maximo.',
    noindex: true,
  },
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'split',
      heading: 'Tank inspection without rope access',
      subheading:
        'A Hoverline dock flies your tank farm every 12 hours. Your inspectors review what changed from the ground, and rope access is booked only for repairs.',
      primaryCta: { label: 'Book a demo', href: '#demo-form' },
      siteType: 'refinery',
    },
    {
      _key: 'operators',
      _type: 'operatorStrip',
      heading: 'Refining and terminal operators',
      operators: operatorsFor('refinery'),
    },
    {
      _key: 'stats',
      _type: 'statsBand',
      stats: stats('permits-avoided', 'detection-lead', 'inspection-hours'),
    },
    {
      _key: 'compare',
      _type: 'comparisonTable',
      heading: 'Compared with your current rounds',
      columns: comparisonColumns.slice(0, 3),
      rows: comparisonRows.map((r) => ({ label: r.label, values: r.values.slice(0, 3) })),
    },
    caseStudy('calder-bay-tank-farm', { key: 'case-calder-bay' }),
    {
      _key: 'integrations',
      _type: 'integrations',
      heading: 'Work orders in the system you use',
      items: integrations('sap-pm', 'maximo', 'infor-eam', 'servicenow'),
    },
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Questions from refinery teams',
      items: faqs('hazardous-areas', 'airspace', 'pricing'),
    },
    {
      _key: 'demo-form',
      _type: 'demoForm',
      heading: 'See a flight over a tank farm',
      body: 'Tell us about your site and we will show you a recorded flight over a tank farm like yours.',
      submitLabel: 'Book a demo',
      nextSteps: [
        'An engineer replies within one business day.',
        'You see a recorded tank-farm flight and the findings it raised.',
      ],
    },
  ],
}

export const seedPages: Page[] = [
  home,
  platform,
  bookADemo,
  refineries,
  powerGrids,
  openPitMining,
  calderBayPage,
  northvalePage,
  sorrelRidgePage,
  exampleLanding,
]

export function getSeedPage(slug: string): Page | undefined {
  return seedPages.find((p) => p.slug === slug)
}

export function getSeedPagesByKind(kind: PageKind): Page[] {
  return seedPages.filter((p) => p.kind === kind)
}
