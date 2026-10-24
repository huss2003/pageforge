import type { Metadata } from 'next'
import { factoryMode } from '@/lib/factory/orchestrator'
import { isAdmin, quotaForRequest } from '@/lib/factory/session'
import { FactoryHeader } from './_components/factory-header'

export const metadata: Metadata = {
  title: { default: 'Factory', template: '%s | PageForge Factory' },
  description: 'Turn a sales brief into a tested, published Hoverline landing page.',
  robots: { index: false, follow: false },
}

export default async function FactoryLayout({ children }: { children: React.ReactNode }) {
  const [admin, quota] = await Promise.all([isAdmin(), quotaForRequest()])
  const mode = factoryMode()
  return (
    <div className="min-h-dvh bg-surface text-fg">
      <FactoryHeader mode={mode} quota={quota} admin={admin} />
      {children}
    </div>
  )
}
