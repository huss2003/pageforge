import type { Metadata } from 'next'
import { DeskShell } from '@/components/abm/desk-shell'

export const metadata: Metadata = {
  title: { default: 'Account pages', template: '%s | PageForge ABM' },
  description: 'Turn an account brief into an evidence-backed Hoverline page.',
  robots: { index: false, follow: false, nocache: true },
}

/** The desk is client-rendered behind a session; no tracking scripts load here. */
export default function AbmLayout({ children }: { children: React.ReactNode }) {
  return <DeskShell>{children}</DeskShell>
}
