import type { BrandFacts } from './types'

/**
 * Hoverline brand facts.
 *
 * Hoverline is fictional. Every operator, person, number and quote below is
 * invented for the PageForge portfolio project and is internally consistent:
 * stats quote the same figures the case studies and specs use, and every
 * operator in a case study or testimonial exists in `operators`.
 *
 * This file is the ONLY source of claims for seed pages and for the writer
 * agent. If a page needs a number that is not here, add it here first.
 */
export const facts: BrandFacts = {
  company: {
    name: 'Hoverline',
    oneLiner:
      'Dock-based drones that fly scheduled inspection routes over refineries, substations and open-pit mines.',
    disclosure:
      'Hoverline is a fictional company. This site is a portfolio project built with PageForge.',
  },

  siteTypes: {
    refinery: {
      label: 'Refinery',
      assets: [
        'Storage tank shells, roofs and floating-roof seals',
        'Flare stacks and flare tips',
        'Pipe racks and insulated lines',
        'Process columns and heat exchangers',
        'Cooling towers',
        'Tank-farm bunds and drainage',
      ],
      typicalFindings: [
        'Hot spot on an insulated line at a pipe-rack support',
        'Corrosion-under-insulation signs on a tank shell',
        'Gap in a floating-roof rim seal',
        'Burner damage on a flare tip',
        'Hydrocarbon sheen inside a tank bund',
      ],
      routeFacts: [
        { label: 'Route length', value: '6.8 km' },
        { label: 'Flight time', value: '31 min' },
        { label: 'Assets covered', value: '140 per flight' },
        { label: 'Cadence', value: 'Every 12 hours' },
      ],
    },
    substation: {
      label: 'Substation',
      assets: [
        'Power transformers and bushings',
        'Circuit breakers and disconnect switches',
        'Busbars, clamps and connectors',
        'Insulator strings',
        'Line spans leaving the yard',
        'Perimeter fence and gates',
      ],
      typicalFindings: [
        'Hot connector on a disconnect switch',
        'Temperature imbalance across transformer bushings',
        'Cracked or flashed-over insulator',
        'Vegetation inside the line clearance zone',
        'Damaged fence panel or gate left open',
      ],
      routeFacts: [
        { label: 'Route length', value: '2.4 km' },
        { label: 'Flight time', value: '14 min' },
        { label: 'Components covered', value: '310 per flight' },
        { label: 'Cadence', value: 'Daily, and after storms' },
      ],
    },
    'open-pit': {
      label: 'Open-pit mine',
      assets: [
        'Pit walls, benches and crests',
        'Haul roads and safety berms',
        'Tailings dam embankments',
        'Stockpiles',
        'Conveyors and transfer points',
        'Dewatering pumps and pipelines',
      ],
      typicalFindings: [
        'Slope movement above the alert threshold',
        'Tension crack behind a bench crest',
        'Haul-road berm below half wheel height',
        'Seepage on a tailings embankment',
        'Conveyor idler running hot',
      ],
      routeFacts: [
        { label: 'Route length', value: '8.9 km' },
        { label: 'Flight time', value: '37 min' },
        { label: 'Area surveyed', value: '3.2 km² per flight' },
        { label: 'Cadence', value: 'Daily, before first shift' },
      ],
    },
  },

  capabilities: [
    {
      id: 'dock',
      title: 'Lives on site in a dock',
      detail:
        'The drone launches, lands and charges in a weatherproof dock beside the area it inspects. No pilot travels to site and nobody carries batteries.',
    },
    {
      id: 'scheduled-routes',
      title: 'Same route, every flight',
      detail:
        'Routes are drawn once on your site plan and flown on a schedule with the same waypoints and camera angles, so every image compares like for like with the last one.',
    },
    {
      id: 'thermal',
      title: 'Radiometric thermal',
      detail:
        'A 640 × 512 radiometric camera records a temperature for every pixel and flags anything above the threshold you set for each asset class.',
    },
    {
      id: 'zoom',
      title: 'Zoom that reads gauges',
      detail:
        'A 48 MP camera with 32× hybrid zoom reads gauge faces, nameplates and bolt heads from a 40 m standoff, outside the exclusion zone around live equipment.',
    },
    {
      id: 'lidar',
      title: 'LiDAR for slopes and volumes',
      detail:
        'Repeat LiDAR surveys measure pit-wall movement to ±8 mm and stockpile volumes without a survey crew on the bench.',
    },
    {
      id: 'change-detection',
      title: 'Only changes reach your team',
      detail:
        'Each flight is compared with the previous ones. Unchanged assets are filed; new hot spots, cracks and movement go to the review queue.',
    },
    {
      id: 'review-queue',
      title: 'An inspector signs off every finding',
      detail:
        'Your inspector sees each finding with its thermal and zoom images and confirms or dismisses it. Nothing becomes a work order without a person agreeing.',
    },
    {
      id: 'work-orders',
      title: 'Findings become work orders',
      detail:
        'Confirmed findings are raised in your maintenance system with the asset ID, location, images and a suggested priority.',
    },
    {
      id: 'bvlos',
      title: 'Beyond visual line of sight',
      detail:
        'Flights run beyond visual line of sight under waivers held for each site, watched by a certified remote pilot in our operations centre or your control room.',
    },
    {
      id: 'on-demand',
      title: 'On-demand flights after an alarm',
      detail:
        'When a gas detector trips or a storm passes, the control room can send the drone to a location in a few clicks. Median time to scene is 4 minutes.',
    },
    {
      id: 'geofencing',
      title: 'Geofences you control',
      detail:
        'No-fly zones around flares, cranes and blasting areas are set in the site plan. The drone returns to the dock when wind or visibility drop below limits.',
    },
    {
      id: 'data-ownership',
      title: 'Your data stays yours',
      detail:
        'You own every image and point cloud. Export it at any time, choose a US or EU region, or run the platform on your own servers.',
    },
  ],

  specs: [
    { id: 'drone-flight-time', label: 'Flight time', value: '42 min (38 min with payload)' },
    { id: 'drone-range', label: 'Route length per flight', value: 'Up to 9 km' },
    { id: 'thermal-sensor', label: 'Thermal camera', value: '640 × 512 radiometric, ±2 °C' },
    { id: 'zoom-sensor', label: 'Zoom camera', value: '48 MP, 32× hybrid zoom' },
    { id: 'lidar-sensor', label: 'LiDAR', value: '240,000 points/s, ±3 cm at 100 m' },
    { id: 'ingress', label: 'Ingress protection', value: 'Drone IP55, dock IP56' },
    { id: 'operating-temp', label: 'Operating temperature', value: '−20 °C to 50 °C' },
    { id: 'wind-limit', label: 'Wind limit', value: '12 m/s sustained, 15 m/s gusts' },
    { id: 'charge-time', label: 'Dock charge time', value: '25 min (10–90%)' },
    { id: 'dock-footprint', label: 'Dock footprint', value: '1.6 × 1.2 m, 105 kg' },
    { id: 'dock-power', label: 'Dock power', value: '220–240 V AC, 1.2 kW peak' },
    { id: 'connectivity', label: 'Connectivity', value: 'Fibre, private LTE/5G or public LTE' },
    {
      id: 'hazardous-area',
      label: 'Hazardous areas',
      value: 'Dock sited outside classified zones; flight paths agreed with site safety',
    },
  ],

  stats: [
    {
      id: 'inspection-hours',
      value: '71',
      unit: '%',
      label: 'fewer person-hours on routine visual inspection',
      basis: 'Median across 14 sites live for 12 months or more, 2025',
    },
    {
      id: 'detection-lead',
      value: '11',
      unit: 'days',
      label: 'earlier warning of developing hot spots than monthly thermography rounds',
      basis: 'Median lead time on confirmed thermal findings, 2025',
    },
    {
      id: 'flight-completion',
      value: '96.4',
      unit: '%',
      label: 'of scheduled flights completed; the rest were held for weather',
      basis: 'All sites, January to December 2025',
    },
    {
      id: 'response-time',
      value: '4',
      unit: 'min',
      label: 'median time from alarm to drone on scene',
      basis: 'On-demand flights across all sites, 2025',
    },
    {
      id: 'permits-avoided',
      value: '1,900',
      label: 'work-at-height permits avoided per site each year',
      basis: 'Median across refinery and substation sites, 2025',
    },
    {
      id: 'slope-resolution',
      value: '±8',
      unit: 'mm',
      label: 'slope movement resolution from repeat LiDAR surveys',
      basis: 'Checked against survey prisms at three mine sites',
    },
  ],

  operators: [
    { id: 'calder-bay', name: 'Calder Bay Refining', sector: 'Refining', siteType: 'refinery' },
    {
      id: 'tessmer',
      name: 'Tessmer Petrochemical',
      sector: 'Petrochemicals',
      siteType: 'refinery',
    },
    {
      id: 'harwick-point',
      name: 'Harwick Point Terminals',
      sector: 'Fuel terminals',
      siteType: 'refinery',
    },
    {
      id: 'northvale',
      name: 'Northvale Transmission',
      sector: 'Electric transmission',
      siteType: 'substation',
    },
    {
      id: 'larkspur',
      name: 'Larkspur Rural Electric',
      sector: 'Electric cooperative',
      siteType: 'substation',
    },
    {
      id: 'sorrel-ridge',
      name: 'Sorrel Ridge Copper',
      sector: 'Copper mining',
      siteType: 'open-pit',
    },
    { id: 'brannock', name: 'Brannock Iron', sector: 'Iron ore', siteType: 'open-pit' },
    {
      id: 'ashgrove',
      name: 'Ashgrove Aggregates',
      sector: 'Quarrying',
      siteType: 'open-pit',
    },
  ],

  caseStudies: [
    {
      id: 'calder-bay-tank-farm',
      slug: 'calder-bay-refining-tank-farm',
      operator: 'Calder Bay Refining',
      siteType: 'refinery',
      heading:
        'Calder Bay Refining moved tank and flare checks from rope access to two flights a day',
      summary:
        'Calder Bay’s tank farm has 46 tanks, two flare stacks and 3.1 km of pipe rack. Rope-access teams inspected the shells once a quarter and thermography ran monthly. One Hoverline dock now flies the full route every 12 hours. Rope access is booked only when a confirmed finding needs hands on steel, and 19 findings went into the turnaround plan before shutdown started.',
      metrics: [
        { value: '64%', label: 'fewer rope-access hours on the tank farm in the first year' },
        { value: '2', label: 'full-route flights a day over 46 tanks and two flares' },
        { value: '19', label: 'findings added to the turnaround plan before shutdown' },
      ],
      quote: {
        text: 'We used to find a failed roof seal when the gas detector told us. Now it shows up in the morning queue with a thermal image and a work order already drafted.',
        name: 'Marisol Grant',
        role: 'Inspection superintendent, Calder Bay Refining',
      },
    },
    {
      id: 'northvale-substations',
      slug: 'northvale-transmission-substations',
      operator: 'Northvale Transmission',
      siteType: 'substation',
      heading:
        'Northvale Transmission found 31 hot connections across 12 substations in one quarter',
      summary:
        'Northvale ran handheld thermography at each of its 12 rural substations twice a year, which meant a long drive and a crew for every visit. Four docks now cover all 12 yards with daily flights and an extra flight after every storm. In the first quarter the flights found 31 connections running hot; each was tightened or replaced at a planned outage.',
      metrics: [
        { value: '31', label: 'hot connections found and repaired in the first quarter' },
        { value: '4', label: 'docks covering 12 substations with daily flights' },
        { value: '0', label: 'unplanned outages from connector failure since go-live' },
      ],
      quote: {
        text: 'Twice a year meant we saw a bad clamp after it had cooked for months. Daily flights catch it in the first week, and we fix it on our schedule instead of during an outage.',
        name: 'Owen Reyes',
        role: 'Substation maintenance manager, Northvale Transmission',
      },
    },
    {
      id: 'sorrel-ridge-pit-walls',
      slug: 'sorrel-ridge-copper-pit-walls',
      operator: 'Sorrel Ridge Copper',
      siteType: 'open-pit',
      heading:
        'Sorrel Ridge Copper replaced weekly slope surveys with a LiDAR flight before every first shift',
      summary:
        'Surveyors at Sorrel Ridge walked the benches with a total station once a week. A Hoverline dock on the pit rim now flies a LiDAR survey of all four walls before the first shift and compares it with the last 30 days. When the east wall moved past the alert threshold, the geotechnical team cleared the bench 41 hours before the crest failed. No one was on it.',
      metrics: [
        { value: 'Daily', label: 'pit-wall surveys, up from weekly' },
        { value: '±8 mm', label: 'movement resolution, checked against survey prisms' },
        { value: '41 h', label: 'warning before a bench crest failure on the east wall' },
      ],
      quote: {
        text: 'The flight is done before the pre-shift meeting. If a wall has moved, the shift boss has the map in hand before anyone drives into the pit.',
        name: 'Priya Natarajan',
        role: 'Principal geotechnical engineer, Sorrel Ridge Copper',
      },
    },
  ],

  testimonials: [
    {
      id: 'tessmer-safety',
      text: 'Our goal was fewer people at height, not more data. Hoverline took routine stack and column checks off the permit board, and our inspectors spend their time on the findings that matter.',
      name: 'Graham Holt',
      role: 'Process safety manager',
      operator: 'Tessmer Petrochemical',
    },
    {
      id: 'harwick-terminals',
      text: 'Findings land in Maximo with the tank number, the image and a priority. My planners did not have to learn a new tool to act on them.',
      name: 'Alana Brooks',
      role: 'Maintenance planning lead',
      operator: 'Harwick Point Terminals',
    },
    {
      id: 'larkspur-storms',
      text: 'After a storm we used to send crews out blind. Now the drones fly every yard first and we roll trucks only to the ones with damage.',
      name: 'Dale Whitcomb',
      role: 'Operations director',
      operator: 'Larkspur Rural Electric',
    },
    {
      id: 'brannock-haul-roads',
      text: 'Berm heights on 22 km of haul road used to be a weekly drive-and-measure job. The flight checks them every morning and flags any section below half wheel height.',
      name: 'Tomasz Wierzbicki',
      role: 'Mine superintendent',
      operator: 'Brannock Iron',
    },
  ],

  integrations: [
    { id: 'sap-pm', name: 'SAP PM', category: 'Maintenance (CMMS)' },
    { id: 'maximo', name: 'IBM Maximo', category: 'Maintenance (CMMS)' },
    { id: 'infor-eam', name: 'Infor EAM', category: 'Maintenance (CMMS)' },
    { id: 'servicenow', name: 'ServiceNow', category: 'Work orders and ITSM' },
    { id: 'aveva-pi', name: 'AVEVA PI', category: 'Process historian' },
    { id: 'arcgis', name: 'Esri ArcGIS', category: 'GIS' },
    { id: 'teams', name: 'Microsoft Teams', category: 'Alerts' },
    { id: 'slack', name: 'Slack', category: 'Alerts' },
    { id: 'entra-id', name: 'Microsoft Entra ID', category: 'Single sign-on' },
    { id: 'okta', name: 'Okta', category: 'Single sign-on' },
    { id: 'power-bi', name: 'Power BI', category: 'Reporting' },
    { id: 's3-export', name: 'Amazon S3', category: 'Data export' },
    { id: 'rest-api', name: 'REST API and webhooks', category: 'Developer' },
  ],

  compliance: [
    {
      id: 'soc2',
      name: 'SOC 2 Type II',
      detail:
        'Audited yearly across security, availability and confidentiality. The latest report is available under NDA.',
    },
    {
      id: 'iso27001',
      name: 'ISO/IEC 27001',
      detail: 'Certified information security management for the platform and operations centre.',
    },
    {
      id: 'bvlos-waivers',
      name: 'FAA BVLOS waivers',
      detail:
        'Flights beyond visual line of sight run under waivers held for each site, with Part 107 certified remote pilots.',
    },
    {
      id: 'nerc-cip',
      name: 'NERC CIP-aligned networking',
      detail:
        'At substations the dock sits on its own network segment with no route into protection or control systems.',
    },
    {
      id: 'data-residency',
      name: 'Data residency',
      detail:
        'Imagery and point clouds stay in the US or EU region you choose, or on your own servers.',
    },
  ],

  faqs: [
    {
      id: 'airspace',
      question: 'Who gets the airspace approvals?',
      answer:
        'We do. Before the first flight we prepare the site’s operations manual and risk assessment and apply for the BVLOS waiver in your name, with your safety team reviewing every step. Approval for a single site typically takes 8 to 12 weeks, and the dock is installed while we wait.',
      tags: ['airspace', 'deployment', 'safety'],
    },
    {
      id: 'hazardous-areas',
      question: 'Can the drone fly over classified hazardous areas?',
      answer:
        'The dock is always installed outside classified zones. Flight paths over Zone 2 areas are agreed with your site safety team and written into the permit to work, the same way you would approve any other mobile equipment. The drone never lands inside a classified zone.',
      tags: ['safety', 'refinery'],
    },
    {
      id: 'weather',
      question: 'What happens in bad weather?',
      answer:
        'The drone flies in light rain and winds up to 12 m/s sustained, from −20 °C to 50 °C. When conditions are outside those limits it holds in the dock and flies the missed route as soon as they clear. Across all sites in 2025, 96.4% of scheduled flights were completed.',
      tags: ['weather', 'operations'],
    },
    {
      id: 'data-ownership',
      question: 'Who owns the images and findings?',
      answer:
        'You do. Every image, point cloud and finding belongs to you and can be exported at any time through the API or to your own storage. We use your data only to run your service, and never to train models for other customers.',
      tags: ['data', 'security'],
    },
    {
      id: 'security',
      question: 'How is site data protected?',
      answer:
        'Data is encrypted in transit and at rest, access uses your single sign-on, and the platform is SOC 2 Type II audited and ISO/IEC 27001 certified. You choose a US or EU region, or run the platform on your own servers.',
      tags: ['security', 'data', 'it'],
    },
    {
      id: 'cmms',
      question: 'Does it work with our maintenance system?',
      answer:
        'Yes. Confirmed findings are raised as work orders in SAP PM, IBM Maximo, Infor EAM or ServiceNow with the asset ID, location, images and a suggested priority. Other systems connect through the REST API and webhooks.',
      tags: ['integration', 'it', 'maintenance'],
    },
    {
      id: 'pilots',
      question: 'Do we need our own drone pilots?',
      answer:
        'No. Certified remote pilots in our operations centre watch every flight. If you would rather run flights from your own control room, we train your operators and they take over the same console.',
      tags: ['operations', 'deployment'],
    },
    {
      id: 'install',
      question: 'What does installation involve?',
      answer:
        'A dock needs a level pad of about 2 × 2 m, a 220–240 V supply and a network connection: fibre, private LTE or public LTE. We survey the site, draw the first routes with your inspectors and fly supervised test flights before the schedule starts. Most sites go from survey to scheduled flights in under 12 weeks.',
      tags: ['deployment', 'it'],
    },
    {
      id: 'pricing',
      question: 'How is Hoverline priced?',
      answer:
        'A yearly subscription per dock that covers the drone, payloads, software, remote pilots and maintenance. Most sites need one dock; large refineries and mines use two or three. We quote after a site survey, so the price reflects your routes rather than a list rate.',
      tags: ['cost', 'procurement'],
    },
    {
      id: 'false-positives',
      question: 'Will my team be buried in alerts?',
      answer:
        'No. Each flight is compared with earlier ones, so unchanged assets are filed without a review. Your inspector only sees what changed, and nothing becomes a work order until they confirm it.',
      tags: ['operations', 'maintenance'],
    },
    {
      id: 'slope-monitoring',
      question: 'Does LiDAR replace our slope radar?',
      answer:
        'No. Slope radar watches one wall continuously; Hoverline surveys every wall, bench and haul road once a day to ±8 mm. Mines use the flights to decide where the radar points and to cover the walls it cannot see.',
      tags: ['mining', 'safety'],
    },
    {
      id: 'substation-clearance',
      question: 'How close does the drone fly to energised equipment?',
      answer:
        'It keeps the minimum approach distance set for each voltage class in your site plan, and the zoom camera reads connectors from a 40 m standoff. Nothing is de-energised for a flight.',
      tags: ['substation', 'safety'],
    },
  ],

  voice: {
    do: [
      'Write in sentence case, in plain words an operations manager would use on site.',
      'Name the asset, the finding and the number: “hot connector on a disconnect switch”, not “issues”.',
      'Quote only numbers, operators and certifications that exist in these facts.',
      'Keep headlines under about 42 characters; put the detail in the supporting line.',
      'Say what happens next: who reviews a finding, where the work order goes.',
      'Name actions by what they do: “Book a demo”, “See the platform”.',
    ],
    dont: [
      'No hype adjectives or genre verbs; see the banned phrases.',
      'No invented customers, quotes, ratings or benchmarks.',
      'No questions the reader did not ask as headlines.',
      'No tricolon slogans such as “Fast. Safe. Smart.”',
      'No all-caps labels, eyebrow text or exclamation marks.',
      'Never imply Hoverline is a real company; the disclosure stays on every page.',
    ],
    bannedPhrases: [
      'elevate',
      'unlock',
      'unleash',
      'seamless',
      'seamlessly',
      'cutting-edge',
      'revolutionize',
      'revolutionise',
      'game-changer',
      'game-changing',
      'in today’s fast-paced',
      'supercharge',
      'empower',
      'world-class',
      'best-in-class',
      'state-of-the-art',
      'next-generation',
      'leverage',
      'robust',
      'effortless',
      'streamline',
      'synergy',
      'all-in-one',
      'harness the power',
      'take it to the next level',
      'reimagine',
    ],
  },
}
