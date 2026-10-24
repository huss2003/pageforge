import { describe, expect, it } from 'vitest'
import { parseBrief } from '../brief'
import { brief } from './helpers'

describe('brief validation', () => {
  it('accepts a complete brief and strips transport fields', () => {
    const r = parseBrief({ ...brief, turnstileToken: 'tok', mode: 'production' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.brief).toEqual(brief)
    expect(r.turnstileToken).toBe('tok')
    expect(r.mode).toBe('production')
  })

  it('trims text and drops empty notes', () => {
    const r = parseBrief({ ...brief, prospect: '  Copper mine  ', notes: '   ' })
    expect(r.ok && r.brief.prospect).toBe('Copper mine')
    expect(r.ok && 'notes' in r.brief).toBe(false)
  })

  it.each([
    ['prospect', { prospect: 'x'.repeat(121) }],
    ['prospect', { prospect: '' }],
    ['siteType', { siteType: 'warehouse' }],
    ['audience', { audience: [] }],
    ['audience', { audience: ['A1', 'B2', 'C3', 'D4', 'E5'] }],
    ['audience', { audience: ['x'.repeat(41)] }],
    ['audience', { audience: ['HSE lead', 'hse lead'] }],
    ['goal', { goal: 'sign-up' }],
    ['notes', { notes: 'n'.repeat(601) }],
  ])('rejects an invalid %s', (field, patch) => {
    const r = parseBrief({ ...brief, ...patch })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(Object.keys(r.fieldErrors)).toContain(field)
  })

  it('rejects a non-object body', () => {
    expect(parseBrief('nope').ok).toBe(false)
    expect(parseBrief(null).ok).toBe(false)
  })
})
