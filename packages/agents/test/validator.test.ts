import { describe, expect, it } from 'vitest'
import type { Block, Page } from '@pageforge/blocks'
import { validatePage } from '../src'
import { clone, facts, goodPage, refineryBrief, substationBrief } from './helpers'

function blockOf<K extends Block['_type']>(page: Page, kind: K): Extract<Block, { _type: K }> {
  const b = page.blocks.find((x) => x._type === kind)
  if (!b) throw new Error(`fixture page has no ${kind}`)
  return b as Extract<Block, { _type: K }>
}

function rules(page: unknown, brief = refineryBrief) {
  return validatePage(page, facts, brief).issues.map((i) => i.rule)
}

describe('validatePage', () => {
  it('accepts a good page for each brief', () => {
    for (const brief of [refineryBrief, substationBrief]) {
      const r = validatePage(goodPage(brief), facts, brief)
      expect(r.errors).toEqual([])
      expect(r.ok).toBe(true)
    }
  })

  it('reports zod errors with block key and field path', () => {
    const page = clone(goodPage())
    const hero = blockOf(page, 'hero')
    hero.heading = 'x'.repeat(120)
    const r = validatePage(page, facts, refineryBrief)
    expect(r.ok).toBe(false)
    expect(r.issues[0]).toMatchObject({ rule: 'schema', blockKey: hero._key })
    expect(r.errors[0]).toContain('heading: must be at most 90 characters')
  })

  it('requires hero first', () => {
    const page = clone(goodPage())
    page.blocks.push(page.blocks.shift()!)
    expect(rules(page)).toContain('placement')
    expect(validatePage(page, facts, refineryBrief).errors.join()).toMatch(
      /first block must be a hero/,
    )
  })

  it('requires the closing block that matches the goal', () => {
    const page = clone(goodPage())
    // book-demo page validated as contact-sales must end with ctaBand.
    const r = validatePage(page, facts, { ...refineryBrief, goal: 'contact-sales' })
    expect(r.errors.join()).toMatch(/last block must be ctaBand for goal "contact-sales"/)
  })

  it('enforces maxPerPage', () => {
    const page = clone(goodPage())
    const stats = blockOf(page, 'statsBand')
    page.blocks.splice(2, 0, { ...stats, _key: 'dup-stats' })
    expect(rules(page)).toContain('max-per-page')
  })

  it('rejects duplicate block keys', () => {
    const page = clone(goodPage())
    page.blocks[1]!._key = page.blocks[0]!._key
    expect(rules(page)).toContain('duplicate-key')
  })

  it('rejects operators, integrations and certifications not in the facts', () => {
    const page = clone(goodPage())
    blockOf(page, 'operatorStrip').operators[0]!.name = 'Acme Oil'
    blockOf(page, 'integrations').items[0]!.name = 'Salesforce'
    blockOf(page, 'compliance').items[0]!.name = 'SOC 2 Type II'
    const r = validatePage(page, facts, refineryBrief)
    expect(r.issues.filter((i) => i.rule === 'fact')).toHaveLength(3)
    expect(r.errors.join('\n')).toMatch(/Acme Oil.*Use only: Gulfline Refining/)
  })

  it('rejects case studies and testimonials that are not in the facts', () => {
    const page = clone(goodPage())
    blockOf(page, 'caseStudy').operator = 'Imaginary Refining'
    page.blocks.splice(3, 0, {
      _key: 't9',
      _type: 'testimonial',
      text: 'Hoverline changed everything for us.',
      name: 'Pat Doe',
      role: 'CEO',
      operator: 'Gulfline Refining',
    })
    const r = validatePage(page, facts, refineryBrief)
    expect(r.issues.filter((i) => i.rule === 'fact').map((i) => i.blockKey)).toEqual(
      expect.arrayContaining([blockOf(page, 'caseStudy')._key, 't9']),
    )
  })

  it('rejects case study metrics and quotes that are not in that case study', () => {
    const page = clone(goodPage())
    const cs = blockOf(page, 'caseStudy')
    cs.metrics[0]!.value = '61%'
    cs.quote = { text: 'Best decision we made.', name: 'Dana Ortiz', role: 'Reliability lead' }
    const r = validatePage(page, facts, refineryBrief)
    expect(r.issues.map((i) => i.rule)).toEqual(expect.arrayContaining(['stat', 'fact']))
  })

  it('requires every stat value to match a fact stat', () => {
    const page = clone(goodPage())
    blockOf(page, 'statsBand').stats[0]!.value = '52'
    const r = validatePage(page, facts, refineryBrief)
    expect(r.issues.some((i) => i.rule === 'stat')).toBe(true)
    expect(r.errors.join()).toMatch(/"52%" is not a brand-facts stat/)
  })

  it('rejects invented numbers anywhere in copy', () => {
    const page = clone(goodPage())
    blockOf(page, 'hero').subheading = 'Cut inspection cost by 73% in the first quarter.'
    const r = validatePage(page, facts, refineryBrief)
    expect(r.issues.find((i) => i.rule === 'number')?.message).toMatch(/"73" in subheading/)
  })

  it('allows numbers that come from the brief', () => {
    const brief = { ...substationBrief }
    const page = clone(goodPage(brief))
    blockOf(page, 'hero').subheading = 'Fly all 40 substations from one control room.'
    expect(validatePage(page, facts, brief).ok).toBe(true)
  })

  it('catches banned phrases case-insensitively, including page title and SEO', () => {
    const page = clone(goodPage())
    blockOf(page, 'featureGrid').features[0]!.body = 'A Seamless way to inspect tanks.'
    page.seo.description =
      'Revolutionary drone inspection for refineries that finds tank corrosion early on every route.'
    const r = validatePage(page, facts, refineryBrief)
    const banned = r.issues.filter((i) => i.rule === 'banned-phrase')
    expect(banned).toHaveLength(2)
    expect(banned[0]!.message).toMatch(/"revolutionary"/i)
  })

  it('catches inflections but not banned words embedded in other words', () => {
    const page = clone(goodPage())
    const grid = blockOf(page, 'featureGrid')
    grid.features[0]!.body = 'The dock is unleveraged hardware.'
    expect(rules(page)).not.toContain('banned-phrase')
    grid.features[0]!.body = 'Leverages thermal data.'
    expect(rules(page)).toContain('banned-phrase')
  })

  it('validates slug format and reserved or existing slugs', () => {
    const bad = clone(goodPage())
    bad.slug = 'Bad Slug'
    expect(rules(bad)).toContain('schema')

    const reserved = clone(goodPage())
    reserved.slug = 'factory'
    expect(rules(reserved)).toContain('slug')

    const taken = clone(goodPage())
    const r = validatePage(taken, facts, refineryBrief, { existingSlugs: [taken.slug] })
    expect(r.errors.join()).toMatch(/already used/)
  })

  it('checks SEO title and description lengths and noindex', () => {
    const page = clone(goodPage())
    page.seo = { title: 'Drones', description: 'Short.', noindex: false }
    const msgs = validatePage(page, facts, refineryBrief).errors.join('\n')
    expect(msgs).toMatch(/seo.title must be 20–60/)
    expect(msgs).toMatch(/seo.description must be 70–160/)
    expect(msgs).toMatch(/noindex must be true/)
  })

  it('flags link labels that do not say what happens', () => {
    const page = clone(goodPage())
    blockOf(page, 'hero').primaryCta.label = 'Click here'
    expect(rules(page)).toContain('link-label')
  })
})
