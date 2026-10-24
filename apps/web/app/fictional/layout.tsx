import type { Metadata } from 'next'

/** Fictional prospect sites used as demo sources: never indexed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default function FictionalLayout({ children }: { children: React.ReactNode }) {
  return children
}
