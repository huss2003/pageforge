import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlockRenderer } from '@pageforge/ui/blocks'
import { getConfig } from '@/lib/factory/config'
import { verifyPreviewToken } from '@/lib/factory/crypto'
import { getStore } from '@/lib/factory/store'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'Draft preview' },
  robots: { index: false, follow: false, nocache: true },
}

/**
 * Draft preview for QA and the Factory iframe. Access needs the HMAC token
 * issued with the run, so preview URLs cannot be guessed from a run id.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const [{ runId }, { t }] = await Promise.all([params, searchParams])
  const token = Array.isArray(t) ? t[0] : t
  if (!verifyPreviewToken(runId, token, getConfig().previewSecret)) notFound()

  const run = await getStore().getRun(runId)
  if (!run?.page) notFound()

  return (
    <main data-run-id={run.id} data-run-status={run.status}>
      <BlockRenderer blocks={run.page.blocks} context={{ preview: true }} />
    </main>
  )
}
