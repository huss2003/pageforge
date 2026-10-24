import type { Metadata } from 'next'
import Link from 'next/link'
import { factoryMode } from '@/lib/factory/orchestrator'
import { getRunPayload, notFoundMessage } from '@/lib/factory/queries'
import { isAdmin } from '@/lib/factory/session'
import { RunView } from '../../_components/run-view'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const payload = await getRunPayload((await params).id)
  return { title: payload ? payload.run.brief.prospect.slice(0, 60) : 'Run not found' }
}

export default async function RunPage({ params }: Props) {
  const { id } = await params
  const [payload, admin] = await Promise.all([getRunPayload(id), isAdmin()])

  if (!payload) {
    return (
      <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
        <h1 className="text-2xl">Run not found</h1>
        <p className="mt-2 max-w-measure text-fg-muted">{notFoundMessage()}</p>
        <Link
          href="/factory"
          className="mt-6 inline-flex rounded-control bg-fg px-4 py-2 text-sm font-semibold text-surface"
        >
          New brief
        </Link>
      </main>
    )
  }

  return <RunView initial={payload} admin={admin} qaMode={factoryMode().qa} />
}
