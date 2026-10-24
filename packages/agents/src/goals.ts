import type { BlockKind } from '@pageforge/blocks'
import type { Brief } from './types'

/**
 * What each brief goal means on the page: the closing block and the CTA
 * every hero and band should use. Labels say what happens next.
 * The demo form section renders with id `demo-form`; other goals point at
 * /book-a-demo, the site's contact page.
 */
export const GOAL_CTAS: Record<Brief['goal'], { label: string; href: string; closing: BlockKind }> =
  {
    'book-demo': { label: 'Book a demo flight', href: '#demo-form', closing: 'demoForm' },
    'download-report': {
      label: 'Request a sample inspection report',
      href: '/book-a-demo?topic=sample-report',
      closing: 'ctaBand',
    },
    'contact-sales': {
      label: 'Talk to an inspection lead',
      href: '/book-a-demo',
      closing: 'ctaBand',
    },
  }

export function closingKind(goal: Brief['goal']): BlockKind {
  return GOAL_CTAS[goal].closing
}

/** Link labels that tell the reader nothing (flagged by Lighthouse `link-text`). */
export const GENERIC_LINK_LABELS = [
  'click here',
  'click this',
  'here',
  'learn more',
  'read more',
  'more',
  'go',
  'start',
  'right here',
  'this',
  'link',
  'continue',
  'submit',
]
