import type { SiteType } from '@pageforge/blocks'
import type { SectionField } from '../primitives/layout'
import type { PlannerFinding, RouteFact } from '../route-planner'

export interface DemoFormState {
  status: 'idle' | 'success' | 'error'
  message?: string
  /** Field name → error message. */
  fieldErrors?: Record<string, string>
}

export interface BlockContext {
  /** Draft previews tag sections with data-block-key so QA issues map to blocks. */
  preview?: boolean
  /** Server action wired by the site; DemoForm uses it with useActionState. */
  demoFormAction?: (prev: DemoFormState, formData: FormData) => Promise<DemoFormState>
  /** Cloudflare Turnstile site key; DemoForm renders the widget when set. */
  turnstileSiteKey?: string
  /**
   * Optional: route planner readout per site, from `facts.siteTypes[s].routeFacts`.
   * The hero falls back to built-in defaults when absent.
   */
  routeFacts?: Partial<Record<SiteType, RouteFact[]>>
  /** Optional: findings shown on each plan (max 3 per site). */
  findings?: Partial<Record<SiteType, PlannerFinding[]>>
}

/** Props every block component accepts besides its schema fields. */
export interface BlockExtras {
  /** Set by BlockRenderer in preview mode. */
  'data-block-key'?: string
  context?: BlockContext
  /**
   * Override the block's own ground. BlockRenderer sets this so two tinted
   * sections never sit back to back; leave it unset when using a block alone.
   */
  field?: SectionField
}
