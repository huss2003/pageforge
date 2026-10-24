import { pageSchema, registry, type Block, type Page } from '@pageforge/blocks'
import { defaultThresholds, meetsThresholds, type QaIssue, type QaThresholds } from '@pageforge/qa'
import type { QaRecord } from './types'

/**
 * Simulated QA for keyless demos. Lighthouse and axe cannot run inside a
 * Vercel function, so without the GitHub Actions runner the Factory scores
 * the page from checks it CAN run on the content itself, using the same
 * issue ids Lighthouse and axe report. Every result is labelled "Simulated QA".
 *
 *  - accessibility: generic link text, duplicate headings
 *  - seo: meta description length, title length
 *  - best practices: schema, placement and per-page limits (validatePage-style)
 *  - performance: a deterministic estimate from block weight
 */
const genericLinkText = /^(learn more|read more|click here|more|here|details)$/i

function seeded(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 0xffffffff
}

function links(block: Block): { label: string; field: string }[] {
  switch (block._type) {
    case 'hero':
      return [
        { label: block.primaryCta.label, field: 'primaryCta.label' },
        ...(block.secondaryCta
          ? [{ label: block.secondaryCta.label, field: 'secondaryCta.label' }]
          : []),
      ]
    case 'ctaBand':
      return [{ label: block.cta.label, field: 'cta.label' }]
    default:
      return []
  }
}

function heading(block: Block): string | undefined {
  return 'heading' in block && typeof block.heading === 'string' ? block.heading : undefined
}

/** Structural checks the validator agent also enforces. */
export function validatePageStructure(page: Page): QaIssue[] {
  const issues: QaIssue[] = []
  const parsed = pageSchema.safeParse(page)
  if (!parsed.success) {
    issues.push({
      source: 'visual',
      id: 'schema',
      message: `Content does not match the block schema: ${parsed.error.issues[0]?.message ?? 'invalid'}.`,
    })
  }
  const counts = new Map<string, number>()
  page.blocks.forEach((b, i) => {
    counts.set(b._type, (counts.get(b._type) ?? 0) + 1)
    const def = registry[b._type]
    if (def.placement === 'first' && i !== 0)
      issues.push({
        source: 'visual',
        id: 'block-placement',
        message: `${def.title} must be the first block.`,
        blockKey: b._key,
      })
    if (def.placement === 'last' && i !== page.blocks.length - 1)
      issues.push({
        source: 'visual',
        id: 'block-placement',
        message: `${def.title} must be the last block.`,
        blockKey: b._key,
      })
    if ((counts.get(b._type) ?? 0) > def.maxPerPage)
      issues.push({
        source: 'visual',
        id: 'block-limit',
        message: `${def.title} appears more than ${def.maxPerPage} time(s).`,
        blockKey: b._key,
      })
  })
  return issues
}

export function simulateQa(page: Page, url: string, attempt: number, now = new Date()): QaRecord {
  const issues: QaIssue[] = []
  const r = seeded(`${page.slug}:${attempt}`)

  // Accessibility (axe-style)
  for (const b of page.blocks) {
    for (const l of links(b)) {
      if (genericLinkText.test(l.label.trim())) {
        issues.push({
          source: 'axe',
          id: 'link-name',
          message: `Link text "${l.label}" does not say where it goes. Name the destination.`,
          blockKey: b._key,
        })
      }
    }
  }
  const seen = new Map<string, string>()
  for (const b of page.blocks) {
    const h = heading(b)?.trim().toLowerCase()
    if (!h) continue
    if (seen.has(h)) {
      issues.push({
        source: 'axe',
        id: 'heading-duplicate',
        message: `Two sections share the heading "${heading(b)}".`,
        blockKey: b._key,
      })
    }
    seen.set(h, b._key)
  }

  // SEO (Lighthouse-style)
  const desc = page.seo.description.trim()
  if (desc.length < 70) {
    issues.push({
      source: 'lighthouse',
      id: 'meta-description',
      message: `Meta description is ${desc.length} characters; search results need 70 to 160 to describe the page.`,
    })
  }
  if (page.seo.title.trim().length < 20) {
    issues.push({
      source: 'lighthouse',
      id: 'document-title',
      message: 'Page title is too short to describe the page in search results.',
    })
  }

  const structural = validatePageStructure(page)
  issues.push(...structural)

  const a11yHits = issues.filter((i) => i.source === 'axe').length
  const seoHits = issues.filter((i) => i.source === 'lighthouse').length

  const scores: QaThresholds = {
    // Heavier pages (more blocks) score a little lower; never below 90 without real assets.
    performance: Math.round(Math.min(100, 100 - page.blocks.length * 0.45 - r * 3)),
    accessibility: a11yHits
      ? Math.max(70, 92 - (a11yHits - 1) * 4 - Math.round(r * 3))
      : 97 + Math.round(r * 3),
    seo: seoHits
      ? Math.max(70, 91 - (seoHits - 1) * 6 - Math.round(r * 3))
      : 98 + Math.round(r * 2),
    bestPractices: structural.length ? 88 : 96 + Math.round(r * 4),
  }

  return {
    attempt,
    createdAt: now.toISOString(),
    url,
    scores,
    issues,
    passed: meetsThresholds(scores, defaultThresholds) && issues.length === 0,
    simulated: true,
  }
}
