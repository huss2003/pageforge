import type { SiteType } from '@pageforge/blocks'

/** Display names for the kinds of site Hoverline flies. */
export const siteLabels: Record<SiteType, string> = {
  refinery: 'Refinery',
  substation: 'Substation',
  'open-pit': 'Open-pit mine',
  port: 'Port terminal',
  'solar-farm': 'Solar farm',
}
