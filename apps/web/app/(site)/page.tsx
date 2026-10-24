import type { Metadata } from 'next'
import { PageView } from '@/components/page-view'
import { loadPage, metadataFor } from '@/lib/content/route'

const kinds = ['home'] as const

export function generateMetadata(): Promise<Metadata> {
  return metadataFor('home', [...kinds])
}

export default async function HomePage() {
  const { page, preview } = await loadPage('home', [...kinds])
  return <PageView page={page} preview={preview} />
}
