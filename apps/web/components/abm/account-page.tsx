import type { Block, Page } from '@pageforge/blocks'
import { BlockRenderer } from '@pageforge/ui/blocks'
import type { CtaConfig } from '@/lib/abm/types'
import { ClosingCta } from './closing-cta'

type DemoFormBlock = Extract<Block, { _type: 'demoForm' }>

/**
 * The body of an account page, shared by the public routes and the desk
 * preview so reviewers see exactly what visitors will. Blocks render through
 * BlockRenderer; the closing demo form is replaced by the campaign's own CTA
 * (calendar or lead form).
 */
export function AccountPageBody({
  page,
  cta,
  campaignId,
  versionId,
  accountName,
  preview = false,
  turnstileSiteKey,
}: {
  page: Pick<Page, 'blocks'>
  cta: CtaConfig
  campaignId: string | null
  versionId: string | null
  accountName?: string | null
  preview?: boolean
  turnstileSiteKey?: string
}) {
  const closing = [...page.blocks].reverse().find((b): b is DemoFormBlock => b._type === 'demoForm')
  const blocks = page.blocks.filter((b) => b._type !== 'demoForm')
  return (
    <>
      <BlockRenderer blocks={blocks} context={{ preview }} />
      <ClosingCta
        heading={closing?.heading ?? 'Talk to a Hoverline engineer'}
        body={closing?.body}
        nextSteps={closing?.nextSteps}
        cta={cta}
        campaignId={campaignId}
        versionId={versionId}
        accountName={accountName}
        interactive={!preview}
        preview={preview}
        blockKey={closing?._key}
        turnstileSiteKey={turnstileSiteKey}
      />
    </>
  )
}
