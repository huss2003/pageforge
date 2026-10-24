import { facts } from '@pageforge/content'
import { productFactsFrom, type AbmBrief, type AccountFact } from '../src'

export { facts }

export const northstarBrief: AbmBrief = {
  companyName: 'Northstar Port Authority',
  industry: 'ports',
  siteCount: 4,
  campaignType: 'demo',
  goal: 'book-meeting',
  painPoints: ['night-time perimeter patrols', 'crane inspections', 'berth security after hours'],
  targetRole: 'Head of Security',
}

export const northstarFacts: AccountFact[] = [
  {
    id: 'f1',
    url: 'https://example.test/fictional/northstar-port-authority',
    quote:
      'Northstar Port Authority operates four container terminals and two cruise berths on the Halden estuary.',
    category: 'scale',
  },
  {
    id: 'f2',
    url: 'https://example.test/fictional/northstar-port-authority/about',
    quote:
      'Our security team patrols 14 kilometres of perimeter fence every night, mostly on foot and by van.',
    category: 'operations',
  },
  {
    id: 'f3',
    url: 'https://example.test/fictional/northstar-port-authority/news',
    quote:
      'Unauthorised access to berths after hours remains the most frequent incident in our security log.',
    category: 'challenges',
  },
]

export const portProducts = productFactsFrom(facts, 'port')
