import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { mapTargetsToBlockKeys, browserScript } from '../src/dom-map'
import {
  axeCounts,
  buildIssues,
  failingAudits,
  lighthouseScores,
  targetRequests,
  type AxeViolationLike,
  type LhrLike,
} from '../src/issues'

const html = readFileSync(
  fileURLToPath(new URL('./fixtures/preview.html', import.meta.url)),
  'utf8',
)
const { document } = parseHTML(html)

/**
 * Lighthouse-style node path (page-functions getNodePath): index among
 * siblings ignoring whitespace-only text, then nodeName. Uses childNodes
 * because linkedom's previousSibling skips the doctype.
 */
function lhPath(el: Node): string {
  const parts: string[] = []
  let node: Node | null = el
  while (node && node.parentNode) {
    const siblings = Array.from(node.parentNode.childNodes).filter(
      (n) => !(n.nodeType === 3 && (n.nodeValue ?? '').trim() === ''),
    )
    parts.push(`${siblings.indexOf(node as ChildNode)},${node.nodeName}`)
    node = node.parentNode
  }
  return parts.reverse().join(',')
}

const violations: AxeViolationLike[] = [
  {
    id: 'image-alt',
    impact: 'critical',
    help: 'Images must have alternate text',
    nodes: [
      {
        target: ['section[data-block-key="b3"] img'],
        failureSummary: 'Fix any of the following:\n  Element does not have an alt attribute',
      },
      { target: ['.site-footer > img'] },
    ],
  },
  {
    id: 'color-contrast',
    impact: 'serious',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    nodes: [{ target: ['.low-contrast'] }],
  },
  {
    id: 'region',
    impact: 'moderate',
    help: 'All page content should be contained by landmarks',
    nodes: [{ target: ['#nowhere'] }],
  },
]

function lhr(): LhrLike {
  const linkPath = lhPath(document.querySelector('a.cta')!)
  return {
    lighthouseVersion: '13.5.0',
    categories: {
      performance: {
        score: 0.97,
        auditRefs: [
          { id: 'largest-contentful-paint', weight: 25 },
          { id: 'unused-javascript', weight: 0 },
        ],
      },
      accessibility: { score: 0.88, auditRefs: [{ id: 'image-alt', weight: 10 }] },
      seo: {
        score: 0.92,
        auditRefs: [
          { id: 'link-text', weight: 1 },
          { id: 'is-crawlable', weight: 0 },
        ],
      },
      'best-practices': { score: 1, auditRefs: [{ id: 'errors-in-console', weight: 1 }] },
    },
    audits: {
      'largest-contentful-paint': {
        id: 'largest-contentful-paint',
        title: 'Largest Contentful Paint',
        score: 0.95,
        scoreDisplayMode: 'numeric',
        displayValue: '1.9 s',
      },
      'unused-javascript': {
        id: 'unused-javascript',
        title: 'Reduce unused JavaScript',
        score: 0.5,
        scoreDisplayMode: 'metricSavings',
      },
      'image-alt': {
        id: 'image-alt',
        title: 'Image elements do not have [alt] attributes',
        score: 0,
        scoreDisplayMode: 'binary',
        details: { items: [] },
      },
      'link-text': {
        id: 'link-text',
        title: 'Links do not have descriptive text',
        score: 0,
        scoreDisplayMode: 'binary',
        details: {
          type: 'table',
          items: [
            {
              node: {
                type: 'node',
                path: linkPath,
                selector: 'section > a.cta',
                nodeLabel: 'Click here',
              },
            },
          ],
        },
      },
      'is-crawlable': {
        id: 'is-crawlable',
        title: 'Page is blocked from indexing',
        score: null,
        scoreDisplayMode: 'notApplicable',
      },
      'errors-in-console': {
        id: 'errors-in-console',
        title: 'No errors',
        score: 1,
        scoreDisplayMode: 'binary',
      },
    },
  }
}

describe('mapTargetsToBlockKeys', () => {
  it('maps axe targets to the closest data-block-key ancestor', () => {
    const map = mapTargetsToBlockKeys(document, [
      { id: 'a', target: ['section[data-block-key="b3"] img'] },
      { id: 'b', target: ['.low-contrast'] },
      { id: 'c', target: ['.site-footer > img'] },
      { id: 'd', target: ['#nowhere'] },
      { id: 'e', target: ['[[invalid'] },
    ])
    expect(map).toEqual({ a: 'b3', b: 'b2', c: null, d: null, e: null })
  })

  it('maps Lighthouse node paths, skipping whitespace text and counting comments', () => {
    const h2 = document.querySelector('[data-block-key="b3"] h2')!
    const path = lhPath(h2)
    expect(path).toBe('1,HTML,1,BODY,1,MAIN,3,SECTION,0,H2') // doctype and the comment node count
    const map = mapTargetsToBlockKeys(document, [
      { id: 'p', path },
      { id: 'bad', path: '1,HTML,1,BODY,9,DIV' },
      { id: 'sel', path: '0,NOPE', selector: '[data-block-key="b1"] h1' },
    ])
    expect(map).toEqual({ p: 'b3', bad: null, sel: 'b1' })
  })

  it('serialises into a self-contained browser script', () => {
    const script = browserScript([mapTargetsToBlockKeys], `mapTargetsToBlockKeys(document, [])`)
    // Evaluate with only `document` in scope, the way page.evaluate would.
    const result = new Function('document', `return ${script}`)(document)
    expect(result).toEqual({})
  })
})

describe('buildIssues', () => {
  it('creates one issue per rule and block, with blockKey when traced', () => {
    const report = lhr()
    const reqs = targetRequests(report, violations)
    const keyMap = mapTargetsToBlockKeys(document, reqs)
    const issues = buildIssues({ lhr: report, violations, keyMap })

    expect(issues).toContainEqual(
      expect.objectContaining({ source: 'lighthouse', id: 'link-text', blockKey: 'b1' }),
    )
    expect(issues.find((i) => i.id === 'link-text')!.message).toBe(
      '[seo] Links do not have descriptive text: Click here',
    )
    // image-alt from axe: one node in a block, one in the footer chrome.
    const alt = issues.filter((i) => i.source === 'axe' && i.id === 'image-alt')
    expect(alt.map((i) => i.blockKey)).toEqual(['b3', undefined])
    expect(alt[0]!.message).toMatch(
      /^critical: Images must have alternate text — Element does not have an alt attribute \(1 node\)$/,
    )
    expect(issues).toContainEqual(
      expect.objectContaining({ source: 'axe', id: 'color-contrast', blockKey: 'b2' }),
    )
    // Weighted perf metric below 0.9 only; passing LCP and zero-weight diagnostics are skipped,
    // except metricSavings opportunities.
    expect(issues.map((i) => i.id)).not.toContain('largest-contentful-paint')
    expect(issues.map((i) => i.id)).toContain('unused-javascript')
    expect(issues.map((i) => i.id)).not.toContain('is-crawlable')
  })

  it('counts axe violations by impact', () => {
    expect(axeCounts(violations)).toEqual({ critical: 1, serious: 1, moderate: 1 })
  })

  it('lists failing audits once even when shared by categories', () => {
    const report = lhr()
    report.categories.seo!.auditRefs.push({ id: 'image-alt', weight: 1 })
    expect(failingAudits(report).filter((a) => a.audit.id === 'image-alt')).toHaveLength(1)
  })
})

describe('lighthouseScores', () => {
  it('converts 0–1 category scores to 0–100', () => {
    expect(lighthouseScores(lhr())).toEqual({
      performance: 97,
      accessibility: 88,
      seo: 92,
      bestPractices: 100,
    })
  })
})
