import { describe, expect, it } from 'vitest'
import { pageSchema, type Page } from '@pageforge/blocks'
import {
  FakeLlm,
  LlmError,
  UNSUPPORTED_CLAIM_PHRASE,
  certificationNames,
  customerNames,
  draftAccountPage,
  numberTokens,
  removeRejectedClaims,
  selectFacts,
  simulateDraft,
  splitSentences,
  validateClaims,
  type CheckableClaim,
  type LlmClient,
} from '../src'
import { facts, northstarBrief, northstarFacts, portProducts } from './abm-fixtures'

const opts = {
  productFacts: portProducts,
  accountFacts: northstarFacts,
  bannedPhrases: facts.voice.bannedPhrases,
  customerNames: customerNames(facts),
  certificationNames: certificationNames(facts),
  accountName: northstarBrief.companyName,
}

async function draft() {
  return draftAccountPage(new FakeLlm(facts), {
    brief: northstarBrief,
    productFacts: portProducts,
    accountFacts: northstarFacts,
    slug: 'northstar-port-authority',
  })
}

describe('text helpers', () => {
  it('splits sentences without breaking on abbreviations or decimals', () => {
    expect(
      splitSentences('Berth No. 4 handles 1.4 million TEU. Cranes run 24/7! Next one?'),
    ).toEqual(['Berth No. 4 handles 1.4 million TEU.', 'Cranes run 24/7!', 'Next one?'])
  })
  it('canonicalises digits and number words', () => {
    expect(numberTokens('four terminals, 1,100 hectares and 2.3% of strings')).toEqual([
      '1100',
      '2.3',
      '4',
    ])
    expect(numberTokens('no one was hurt')).toEqual([])
  })
})

describe('draftAccountPage (simulated)', () => {
  it('builds a registry-only Northstar page with sourced claims and one unsupported claim', async () => {
    const d = await draft()
    expect(d.calls).toBe(1)
    expect(pageSchema.safeParse(d.page).success).toBe(true)
    expect(d.page.blocks[0]?._type).toBe('hero')
    expect(d.page.blocks.at(-1)?._type).toBe('demoForm')
    expect(d.page.slug).toBe('northstar-port-authority')
    expect(d.page.seo.noindex).toBe(true)
    const hero = d.page.blocks[0]
    expect(hero?._type === 'hero' && hero.siteType).toBe('port')

    const v = validateClaims(d.page, d.claims, opts)
    const bad = d.claims.filter((_, i) => !v.checks[i]!.ok)
    expect(bad).toHaveLength(1)
    expect(bad[0]!.text).toContain(UNSUPPORTED_CLAIM_PHRASE)
    expect(v.checks[d.claims.indexOf(bad[0]!)]!.reasons.join(' ')).toMatch(/40/)
    expect(v.unsourced).toEqual([])
    expect(v.pageIssues).toEqual([])
    // Account facts are quoted verbatim and cited.
    expect(d.claims.filter((c) => c.kind === 'account_fact').length).toBe(3)
  })

  it('always includes the unsupported claim, for every industry', () => {
    for (const industry of ['solar', 'refineries', 'power-grids', 'open-pit-mining'] as const) {
      const out = simulateDraft(
        { ...northstarBrief, industry, companyName: 'Halvorsen' },
        [],
        facts,
      )
      expect(out.claims.filter((c) => c.text.includes(UNSUPPORTED_CLAIM_PHRASE))).toHaveLength(1)
    }
  })

  it('repairs once, then gives up', async () => {
    const good = simulateDraft(northstarBrief, [], facts)
    const scripted = (answers: unknown[]): LlmClient & { tasks: string[] } => {
      const tasks: string[] = []
      return {
        tasks,
        async generateJson(o) {
          tasks.push(o.task)
          const parsed = o.schema.safeParse(answers.shift())
          if (!parsed.success)
            throw new LlmError({
              kind: 'schema',
              provider: 't',
              model: 't',
              message: 'bad',
              issues: ['blocks: bad'],
            })
          return { data: parsed.data, model: 't' }
        },
      }
    }
    const broken = { ...good, blocks: [{ _key: 'x', _type: 'hero' }] }
    const once = scripted([broken, good])
    const d = await draftAccountPage(once, {
      brief: northstarBrief,
      productFacts: portProducts,
      accountFacts: [],
    })
    expect(once.tasks).toEqual(['abm-draft', 'abm-repair'])
    expect(d.calls).toBe(2)

    // A structurally wrong page (no hero first) also triggers the repair.
    const noHero = { ...good, blocks: good.blocks.slice(1) }
    const twice = scripted([noHero, noHero])
    await expect(
      draftAccountPage(twice, {
        brief: northstarBrief,
        productFacts: portProducts,
        accountFacts: [],
      }),
    ).rejects.toThrow(/after a repair/)
  })
})

describe('validateClaims rules', () => {
  const page = (): Page => ({
    kind: 'landing',
    title: 'Test',
    slug: 'test',
    seo: { title: 'Test', description: 'Test page', noindex: true },
    blocks: [
      {
        _key: 'h',
        _type: 'hero',
        variant: 'statement',
        heading: 'Patrols for Northstar',
        subheading: 'Hoverline covers 7.5 km of perimeter on each patrol flight.',
        primaryCta: { label: 'Book a demo call', href: '#demo-form' },
        siteType: 'port',
      },
    ],
  })
  const base: CheckableClaim = {
    blockKey: 'h',
    field: 'subheading',
    text: 'Hoverline covers 7.5 km of perimeter on each patrol flight.',
    kind: 'product_fact',
    sources: [{ type: 'product_fact', factId: 'stat:patrol-coverage', label: 'x' }],
  }

  it('accepts a product claim whose numbers are in the cited fact', () => {
    const v = validateClaims(page(), [base], opts)
    expect(v.checks[0]).toEqual({ ok: true, reasons: [] })
  })

  it('rejects numbers that are not in the cited fact, and unknown fact ids', () => {
    const v = validateClaims(
      page(),
      [
        { ...base, sources: [{ type: 'product_fact', factId: 'stat:night-patrols', label: 'x' }] },
        { ...base, sources: [{ type: 'product_fact', factId: 'stat:nope', label: 'x' }] },
      ],
      opts,
    )
    expect(v.checks[0]!.reasons.join()).toMatch(/Number 7.5/)
    expect(v.checks[1]!.reasons.join()).toMatch(/not an approved Hoverline fact/)
  })

  it('positioning claims cannot contain numbers', () => {
    const v = validateClaims(page(), [{ ...base, kind: 'positioning', sources: [] }], opts)
    expect(v.checks[0]!.ok).toBe(false)
    expect(v.checks[0]!.reasons[0]).toMatch(/Positioning cannot contain numbers/)
  })

  it('account claims need an included source with matching terms and numbers', () => {
    const p = page()
    const hero = p.blocks[0]!
    if (hero._type === 'hero')
      hero.subheading = 'Northstar runs four container terminals and two cruise berths.'
    const claim: CheckableClaim = {
      ...base,
      text: 'Northstar runs four container terminals and two cruise berths.',
      kind: 'account_fact',
      sources: [{ type: 'account_source', sourceFactId: 'f1', url: 'u', quote: 'q' }],
    }
    expect(validateClaims(p, [claim], opts).checks[0]!.ok).toBe(true)
    // Excluded fact (not in the included list) → invalid.
    const excluded = validateClaims(p, [claim], { ...opts, accountFacts: northstarFacts.slice(1) })
    expect(excluded.checks[0]!.reasons.join()).toMatch(/excluded/)
    // Wrong quote: terms and numbers do not match.
    const wrong = validateClaims(
      p,
      [
        {
          ...claim,
          sources: [{ type: 'account_source', sourceFactId: 'f3', url: 'u', quote: 'q' }],
        },
      ],
      opts,
    )
    expect(wrong.checks[0]!.reasons.join(' ')).toMatch(/Number 4, 2|Key terms/)
  })

  it('flags claim text that is not in the field', () => {
    const v = validateClaims(page(), [{ ...base, field: 'heading' }], opts)
    expect(v.checks[0]!.reasons.join()).toMatch(/does not appear in heading/)
  })

  it('creates Unsourced statement claims for numbers, customers and certifications', () => {
    const p = page()
    const hero = p.blocks[0]!
    if (hero._type === 'hero')
      hero.heading = 'Calder Bay Refining saves $2 million with SOC 2 Type II flights'
    const v = validateClaims(p, [base], opts)
    expect(v.unsourced).toHaveLength(1)
    const u = v.unsourced[0]!
    expect(u.claim).toMatchObject({
      blockKey: 'h',
      field: 'heading',
      sources: [],
      origin: 'validator',
    })
    expect(u.check.ok).toBe(false)
    expect(u.check.reasons[0]).toMatch(/^Unsourced statement/)
    // Covered once a claim (any non-rejected) exists for it.
    const covered = validateClaims(p, [base, { ...u.claim, status: 'needs_review' }], opts)
    expect(covered.unsourced).toHaveLength(0)
  })

  it('reports banned phrases and schema problems as page issues', () => {
    const p = page()
    const hero = p.blocks[0]!
    if (hero._type === 'hero') hero.heading = 'Elevate your patrols'
    expect(validateClaims(p, [], opts).pageIssues.join()).toMatch(/Banned phrase "elevate"/)
  })
})

describe('removeRejectedClaims', () => {
  it('removes the rejected sentence and keeps the rest of the field', async () => {
    const d = await draft()
    const claims = d.claims.map((c) => ({
      ...c,
      status: c.text.includes(UNSUPPORTED_CLAIM_PHRASE)
        ? ('rejected' as const)
        : ('supported' as const),
    }))
    const r = removeRejectedClaims(d.page, claims)
    const grid = r.page.blocks.find((b) => b._key === 'b2')
    expect(grid?._type === 'featureGrid' && grid.intro).toBe(
      'Each point below starts from something Northstar Port Authority has published.',
    )
    expect(JSON.stringify(r.page)).not.toContain('40%')
    expect(r.removedBlocks).toEqual([])
    expect(r.emptyFields).toEqual([])
    expect(r.changed).toBe(true)
  })

  it('removes a list item and re-points later claims', async () => {
    const d = await draft()
    const claims = d.claims.map((c) => ({
      ...c,
      status: c.field === 'stats[1]' ? ('rejected' as const) : ('supported' as const),
    }))
    const r = removeRejectedClaims(d.page, claims)
    const band = r.page.blocks.find((b) => b._key === 'b3')
    expect(band?._type === 'statsBand' && band.stats.length).toBe(3)
    const moved = r.claims.filter((c) => c.blockKey === 'b3' && c.status === 'supported')
    expect(moved.map((c) => c.field)).toEqual(['stats[0]', 'stats[1]', 'stats[2]', 'heading'])
  })

  it('removes a block when every claim in it is rejected', async () => {
    const d = await draft()
    const claims = d.claims.map((c) => ({
      ...c,
      status: c.blockKey === 'b5' ? ('rejected' as const) : ('supported' as const),
    }))
    const r = removeRejectedClaims(d.page, claims)
    expect(r.removedBlocks).toEqual(['b5'])
    expect(r.page.blocks.some((b) => b._key === 'b5')).toBe(false)
  })

  it('reports required fields left empty on structural blocks', async () => {
    const d = await draft()
    const claims = d.claims.map((c) => ({
      ...c,
      status: c.blockKey === 'b1' ? ('rejected' as const) : ('supported' as const),
    }))
    const r = removeRejectedClaims(d.page, claims)
    expect(r.page.blocks[0]?._type).toBe('hero')
    expect(r.emptyFields).toEqual(expect.arrayContaining(['b1.heading', 'b1.subheading']))
  })
})

describe('selectFacts', () => {
  it('maps model indexes back to sentences and drops bad indexes', async () => {
    const llm: LlmClient = {
      async generateJson(o) {
        return {
          data: o.schema.parse({
            facts: [
              { index: 1, category: 'scale' },
              { index: 9, category: 'other' },
              { index: 1, category: 'scale' },
              { index: 0, category: 'challenges' },
            ],
          }),
          model: 'm',
        }
      },
    }
    const r = await selectFacts(llm, { brief: northstarBrief, sentences: ['a', 'b'] })
    expect(r.facts).toEqual([
      { index: 1, category: 'scale' },
      { index: 0, category: 'challenges' },
    ])
  })

  it('simulated picker keeps concrete sentences', async () => {
    const r = await selectFacts(new FakeLlm(facts), {
      brief: northstarBrief,
      sentences: [
        'Welcome.',
        'Northstar Port Authority operates four container terminals on the estuary.',
        'Theft from container stacks after dark is a growing challenge for the port.',
        'The 2027 security programme will add thermal cameras to every berth.',
      ],
    })
    expect(r.facts.map((f) => f.index)).toEqual([1, 2, 3])
    expect(r.facts.map((f) => f.category)).toEqual(['operations', 'challenges', 'initiatives'])
  })
})
