import type { Page } from '@pageforge/blocks'
import type { CtaConfig } from '@/lib/abm/types'

/**
 * Messages between the desk and its preview iframe (/abm/preview). The
 * iframe renders the page at a real viewport width, so the blocks'
 * breakpoints apply exactly as on the live page.
 */
export type ToPreview =
  | {
      type: 'pf-preview:render'
      page: Pick<Page, 'blocks'>
      cta: CtaConfig
      accountName: string | null
    }
  | { type: 'pf-preview:highlight'; blockKey: string | null; scroll: boolean }

export type FromPreview =
  { type: 'pf-preview:ready' } | { type: 'pf-preview:hover'; blockKey: string | null }

export function isToPreview(d: unknown): d is ToPreview {
  return (
    typeof d === 'object' &&
    d !== null &&
    String((d as { type?: unknown }).type).startsWith('pf-preview:')
  )
}
