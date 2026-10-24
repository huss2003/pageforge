import { describe, expect, it } from 'vitest'
import type { Page } from '@pageforge/blocks'
import { editableFields, readField, writeField } from '@/components/abm/block-fields'
import { claimCounts, groupClaimsByBlock, publishBlockers } from '@/components/abm/claims'
import { fieldLabel } from '@/components/abm/labels'
import type { Claim, VersionWithClaims } from '@/lib/abm/types'

const page: Pick<Page, 'blocks'> = {
  blocks: [
    {
      _key: 'hero',
      _type: 'hero',
      variant: 'statement',
      heading: 'Night patrols for four terminals',
      subheading: 'Docked drones fly the same perimeter route every night.',
      primaryCta: { label: 'Book a walkthrough', href: '#book' },
      siteType: 'refinery',
    },
    {
      _key: 'stats',
      _type: 'statsBand',
      stats: [
        { value: '4', unit: 'min', label: 'median time from alarm to drone on scene' },
        { value: '96.4', unit: '%', label: 'of scheduled flights completed' },
      ],
    },
    {
      _key: 'faq',
      _type: 'faq',
      heading: 'Questions',
      items: [
        { question: 'Do we need pilots?', answer: 'No.' },
        { question: 'How long?', answer: 'Under 12 weeks.' },
      ],
    },
  ],
}

let n = 0
function claim(over: Partial<Claim>): Claim {
  n++
  return {
    id: `c${n}`,
    versionId: 'v1',
    blockKey: 'hero',
    field: 'subheading',
    text: 'claim',
    kind: 'product_fact',
    sources: [],
    status: 'supported',
    validator: { ok: true, reasons: [] },
    reviewedBy: null,
    reviewedAt: null,
    note: null,
    ...over,
  }
}

function version(over: Partial<VersionWithClaims>): VersionWithClaims {
  return {
    id: 'v1',
    campaignId: 'cmp',
    number: 2,
    createdAt: '2026-10-24T10:00:00Z',
    createdBy: 'system',
    origin: 'ai_draft',
    state: 'in_review',
    page: {
      kind: 'landing',
      title: 't',
      slug: 's',
      seo: { title: 't', description: 'd', noindex: true },
      blocks: page.blocks,
    },
    seo: {
      title: 't',
      description: 'd',
      noindex: true,
      canonicalUrl: 'https://x',
      ogImageUrl: '/og',
    },
    cta: { label: 'Book', kind: 'calendar', formFields: [] },
    model: null,
    simulated: true,
    approvedBy: null,
    approvedAt: null,
    claims: [],
    publishBlockers: [],
    ...over,
  }
}

describe('groupClaimsByBlock', () => {
  it('follows page order, puts claims needing review first and keeps removed blocks', () => {
    const claims = [
      claim({ blockKey: 'stats', field: 'stats[0].value', text: 'a' }),
      claim({ blockKey: 'hero', text: 'b' }),
      claim({ blockKey: 'stats', field: 'stats[1].value', text: 'c', status: 'needs_review' }),
      claim({ blockKey: 'gone', text: 'd', status: 'rejected' }),
    ]
    const groups = groupClaimsByBlock(page, claims)
    expect(groups.map((g) => g.label)).toEqual([
      'Hero',
      'Stats band',
      'FAQ',
      'Removed from the page',
    ])
    expect(groups[1]!.claims.map((c) => c.text)).toEqual(['c', 'a'])
    expect(groups[2]!.claims).toEqual([])
    expect(groups[3]!.blockType).toBeNull()
  })

  it('counts claims by status', () => {
    expect(
      claimCounts([claim({}), claim({ status: 'needs_review' }), claim({ status: 'rejected' })]),
    ).toEqual({
      supported: 1,
      needs_review: 1,
      rejected: 1,
      total: 3,
    })
  })
})

describe('publishBlockers', () => {
  it('names the number of claims to review and the approval state', () => {
    const v = version({
      claims: [claim({ status: 'needs_review' }), claim({ status: 'needs_review' }), claim({})],
      publishBlockers: ['2 claims need review'],
    })
    expect(publishBlockers(v).map((b) => b.text)).toEqual([
      '2 claims need review',
      'Version 2 is not approved yet',
    ])
    expect(publishBlockers(v, { forPublish: false }).map((b) => b.text)).toEqual([
      '2 claims need review',
    ])
  })

  it('says which field became empty after a rejected claim', () => {
    const blocks = structuredClone(page.blocks)
    ;(blocks[0] as { heading: string }).heading = ''
    const v = version({
      state: 'approved',
      page: { ...version({}).page, blocks },
      claims: [
        claim({ field: 'heading', status: 'rejected', text: 'Night patrols for four terminals' }),
      ],
    })
    const out = publishBlockers(v)
    expect(out.map((b) => b.text)).toEqual(['Hero heading is empty after a rejected claim'])
    expect(out[0]!.blockKey).toBe('hero')
  })

  it('reports a list that lost too many items, and keeps server-only problems', () => {
    const blocks = structuredClone(page.blocks)
    ;(blocks[1] as { stats: unknown[] }).stats.splice(1, 1)
    const v = version({
      state: 'approved',
      page: { ...version({}).page, blocks },
      publishBlockers: ['Banned phrase: "seamless"', '1 claim needs review'],
    })
    expect(publishBlockers(v).map((b) => b.text)).toEqual([
      'Stats band needs at least 2 stats',
      'Banned phrase: "seamless"',
    ])
  })

  it('is empty for an approved version with nothing left to review', () => {
    expect(publishBlockers(version({ state: 'approved', claims: [claim({})] }))).toEqual([])
  })
})

describe('block fields', () => {
  it('lists editable copy from the schema', () => {
    const fields = editableFields(page.blocks[1]!)
    expect(fields.map((f) => f.path)).toEqual([
      'heading',
      'stats[0].value',
      'stats[0].unit',
      'stats[0].label',
      'stats[0].basis',
      'stats[1].value',
      'stats[1].unit',
      'stats[1].label',
      'stats[1].basis',
    ])
    expect(fields.find((f) => f.path === 'stats[0].label')).toMatchObject({
      max: 90,
      kind: 'text',
      value: 'median time from alarm to drone on scene',
    })
    const hero = editableFields(page.blocks[0]!)
    expect(hero.find((f) => f.path === 'subheading')?.kind).toBe('textarea')
    expect(hero.find((f) => f.path === 'variant')?.options).toEqual(['route', 'statement', 'split'])
  })

  it('reads and writes nested paths without mutating', () => {
    const block = page.blocks[1]!
    const next = writeField(block, 'stats[1].value', '97')
    expect(readField(next, 'stats[1].value')).toBe('97')
    expect(readField(block, 'stats[1].value')).toBe('96.4')
  })

  it('labels fields for people', () => {
    expect(fieldLabel('stats[1].value')).toBe('Stat 2 value')
    expect(fieldLabel('primaryCta.label')).toBe('Primary CTA label')
    expect(fieldLabel('items[0].answer')).toBe('Item 1 answer')
  })
})
