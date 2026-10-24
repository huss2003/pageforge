/**
 * Content of the fictional prospect sites served at /fictional/* (spec §5).
 * The pages render this data and the demo seed extracts sentences from it,
 * so the seeded sources match what the live fetcher reads. Both
 * organisations are invented for the PageForge portfolio demo.
 */
export interface FictionalSection {
  heading: string
  paragraphs: string[]
  list?: string[]
}

export interface FictionalPage {
  /** Path under the site root: '' for home, 'about', … */
  path: string
  title: string
  heading: string
  lede: string
  sections: FictionalSection[]
}

export interface FictionalSite {
  slug: string
  name: string
  short: string
  tagline: string
  accent: string
  address: string
  pages: FictionalPage[]
}

export const FICTIONAL_BANNER = 'Fictional organisation for a portfolio demo'

export const northstar: FictionalSite = {
  slug: 'northstar-port-authority',
  name: 'Northstar Port Authority',
  short: 'Northstar',
  tagline: 'Container, reefer and cruise terminals on the Halden estuary',
  accent: '#0B4F6C',
  address: 'Harbour House, 1 Quay Road, Halden',
  pages: [
    {
      path: '',
      title: 'Northstar Port Authority',
      heading: 'The deep-water gateway on the Halden estuary',
      lede: 'Northstar Port Authority operates four container terminals and two cruise berths on the Halden estuary.',
      sections: [
        {
          heading: 'The port in numbers',
          paragraphs: [
            'The port handled 2.8 million TEU in 2025, up 6% on the previous year.',
            'Terminal 3 runs around the clock, with 14 ship-to-shore cranes working vessels of up to 18,000 TEU.',
            'Northstar employs 1,450 people directly and supports an estimated 9,000 jobs in the region.',
          ],
        },
        {
          heading: 'Plan 2030',
          paragraphs: [
            "The authority's 2026 to 2030 plan commits to automating gate processing and modernising perimeter security across all four terminals.",
            'Investment in the plan is funded from port dues and does not draw on regional taxes.',
          ],
        },
      ],
    },
    {
      path: 'about',
      title: 'About the authority',
      heading: 'About Northstar Port Authority',
      lede: 'Northstar Port Authority is a self-financing public body governed by a board appointed by the regional government.',
      sections: [
        {
          heading: 'The estate',
          paragraphs: [
            'The port estate covers 1,100 hectares of land and 22 kilometres of quay and waterfront.',
            'Land-side access is through two truck gates and a rail terminal shared by Terminals 3 and 4.',
          ],
        },
        {
          heading: 'Security',
          paragraphs: [
            'Security across the estate is managed by the Port Security Unit, a team of 120 officers working in three shifts.',
            "Northstar's security officers patrol 14 kilometres of perimeter fence every night, mostly on foot and by van.",
            'Every terminal has its own port facility security plan, reviewed each year with the national maritime security agency.',
          ],
        },
      ],
    },
    {
      path: 'facilities',
      title: 'Facilities',
      heading: 'Terminals and berths',
      lede: 'Four container terminals, two cruise berths and an inland empty-container depot.',
      sections: [
        {
          heading: 'Container terminals',
          paragraphs: [
            'Terminal 1 and Terminal 2 handle feeder services and short-sea container traffic.',
            'Terminal 3 is the deep-water terminal, with a 1,240-metre quay and 14 ship-to-shore cranes.',
            'Terminal 4 opened in 2024 and specialises in refrigerated cargo, with 3,200 reefer plugs.',
          ],
        },
        {
          heading: 'Cruise and depots',
          paragraphs: [
            'The two cruise berths at Halden Quay welcomed 310 cruise calls in the 2025 season.',
            'Empty containers are stored at the Brack Lane depot, 2 kilometres inland from the main gate.',
          ],
          list: [
            'Halden Quay cruise berths 1 and 2, with a shared passenger terminal.',
            'Brack Lane depot, open to hauliers from 06:00 to 22:00.',
          ],
        },
      ],
    },
    {
      path: 'news',
      title: 'News',
      heading: 'News from the port',
      lede: 'Updates on operations, security and investment at Northstar.',
      sections: [
        {
          heading: 'Review of night-time security coverage',
          paragraphs: [
            'In March 2026 the authority launched a review of night-time security coverage at Terminals 3 and 4.',
            "Unauthorised access to berths after hours remains the most frequent incident in the Port Security Unit's log.",
            'Northstar recorded 41 perimeter fence breaches in 2025, most of them at the Brack Lane depot.',
          ],
        },
        {
          heading: 'Crane maintenance programme',
          paragraphs: [
            'Crane inspections currently require a lift team and a two-hour stoppage per crane each quarter.',
            'The board has approved a pilot of remote monitoring for the perimeter, to start in 2027.',
          ],
        },
      ],
    },
  ],
}

export const halvorsen: FictionalSite = {
  slug: 'halvorsen-solar-partners',
  name: 'Halvorsen Solar Partners',
  short: 'Halvorsen',
  tagline: 'Independent owner and operator of utility-scale solar',
  accent: '#7A5C00',
  address: 'Fjordgata 12, Aarvik',
  pages: [
    {
      path: '',
      title: 'Halvorsen Solar Partners',
      heading: 'Utility-scale solar, owned and operated',
      lede: 'Halvorsen Solar Partners owns and operates six utility-scale solar farms with a combined capacity of 1.4 GW.',
      sections: [
        {
          heading: 'Our portfolio',
          paragraphs: [
            'The portfolio produced 2,350 GWh of electricity in 2025, enough for around 560,000 homes.',
            "Halvorsen's asset management team of 38 people runs operations from a control centre in Aarvik.",
            'The company plans to add 400 MW of capacity and battery storage at two sites by 2028.',
          ],
        },
      ],
    },
    {
      path: 'about',
      title: 'About us',
      heading: 'About Halvorsen Solar Partners',
      lede: 'Halvorsen Solar Partners was founded in 2014 by a group of infrastructure investors and engineers.',
      sections: [
        {
          heading: 'How we operate',
          paragraphs: [
            'Each site has a resident technician team, supported by specialist contractors for thermal surveys and cleaning.',
            'Thermal surveys are carried out by contractors with handheld cameras once a year at each site.',
            'Soiling from agricultural dust reduces output at the two inland sites during the summer harvest.',
          ],
        },
      ],
    },
    {
      path: 'projects',
      title: 'Projects',
      heading: 'Our solar farms',
      lede: 'Six sites from the coast to the inland plateau.',
      sections: [
        {
          heading: 'Sites',
          paragraphs: [
            'Brekke Solar Park is the largest site in the portfolio, with 410 MW on single-axis trackers.',
            'Sundvik and Ostmark were built in 2016 and are the oldest sites, with 180 MW between them.',
            'Vegetation management across the six sites covers more than 2,900 hectares of land.',
          ],
        },
        {
          heading: 'Performance',
          paragraphs: [
            'Inverter failures caused most of the unplanned downtime recorded in 2025.',
            'A repowering study for the Sundvik site is due to report in 2027.',
          ],
        },
      ],
    },
  ],
}

export const fictionalSites = [northstar, halvorsen]

export function fictionalPage(site: FictionalSite, path: string): FictionalPage {
  const page = site.pages.find((p) => p.path === path)
  if (!page) throw new Error(`No fictional page ${site.slug}/${path}`)
  return page
}

/** Readable sentences of one fictional page, as the extractor would find them. */
export function fictionalText(page: FictionalPage): string[] {
  return [page.lede, ...page.sections.flatMap((s) => [...s.paragraphs, ...(s.list ?? [])])]
}
