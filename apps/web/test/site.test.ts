import { describe, expect, it } from 'vitest'
import { seedPages } from '@pageforge/content'
import { parseDemoRequest } from '@/lib/leads'
import { pathForPage } from '@/lib/paths'
import { pageJsonLd } from '@/lib/seo'

describe('paths', () => {
  it('routes each kind to its section', () => {
    const paths = Object.fromEntries(seedPages.map((p) => [p.slug, pathForPage(p)]))
    expect(paths.home).toBe('/')
    expect(paths.platform).toBe('/platform')
    expect(paths['book-a-demo']).toBe('/book-a-demo')
    expect(paths.refineries).toBe('/industries/refineries')
    expect(paths['calder-bay-refining-tank-farm']).toBe(
      '/case-studies/calder-bay-refining-tank-farm',
    )
    expect(paths['example-refinery-tank-inspection']).toBe('/lp/example-refinery-tank-inspection')
  })
})

describe('JSON-LD', () => {
  const graphFor = (slug: string) => {
    const page = seedPages.find((p) => p.slug === slug)!
    return (pageJsonLd(page)['@graph'] as { '@type': string }[]).map((n) => n['@type'])
  }

  it('home has Organization, WebSite, WebPage, BreadcrumbList and FAQPage', () => {
    expect(graphFor('home')).toEqual(
      expect.arrayContaining(['Organization', 'WebSite', 'WebPage', 'BreadcrumbList', 'FAQPage']),
    )
  })

  it('case studies add an Article', () => {
    expect(graphFor('calder-bay-refining-tank-farm')).toContain('Article')
  })

  it('pages without a FAQ block have no FAQPage', () => {
    expect(graphFor('northvale-transmission-substations')).not.toContain('FAQPage')
  })
})

describe('demo request validation', () => {
  const form = (fields: Record<string, string>) => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    return fd
  }

  it('accepts a complete request and trims fields', () => {
    const result = parseDemoRequest(
      form({
        name: '  Jo Park ',
        email: ' JO@Example.com ',
        company: 'Acme',
        siteType: 'refinery',
        message: '',
      }),
    )
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      name: 'Jo Park',
      email: 'jo@example.com',
      siteType: 'refinery',
    })
    expect(result.data?.message).toBeUndefined()
  })

  it('reports field errors', () => {
    const result = parseDemoRequest(
      form({ name: '', email: 'nope', company: 'A', message: 'x'.repeat(1001) }),
    )
    expect(result.success).toBe(false)
    const fields = result.error!.issues.map((i) => i.path[0])
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'message']))
  })
})

describe('submitLead without Supabase', () => {
  it('validates and answers in demo mode without storing', async () => {
    const { submitLead } = await import('@/lib/leads')
    const fd = new FormData()
    fd.set('name', 'Jo Park')
    fd.set('email', 'jo@example.com')
    fd.set('company', 'Acme Refining')
    const state = await submitLead(fd, { ip: '203.0.113.7' })
    expect(state.status).toBe('success')
    expect(state.message).toMatch(/not stored/)
  })

  it('returns field errors for an invalid request', async () => {
    const { submitLead } = await import('@/lib/leads')
    const state = await submitLead(new FormData(), {})
    expect(state.status).toBe('error')
    expect(state.fieldErrors).toMatchObject({
      name: expect.any(String),
      company: expect.any(String),
    })
  })
})
