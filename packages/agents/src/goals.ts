import type { BlockKind } from '@pageforge/blocks'
import type { Brief } from './types'

/**
 * What each brief goal means on the page: the closing block and the CTA
 * every hero and band should use. Labels say what happens next.
 * The demo form section is expected at `#demo` on rendered pages.
 */
export const GOAL_CTAS: Record<Brief['goal'], { label: string; href: string; closing: BlockKind }> =
  {
    'book-demo': { label: 'Book a demo flight', href: '#demo', closing: 'demoForm' },
    'download-report': {
      label: 'Download the sample report',
      href: '/resources/sample-inspection-report',
      closing: 'ctaBand',
    },
    'contact-sales': { label: 'Talk to an inspection lead', href: '/contact', closing: 'ctaBand' },
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
