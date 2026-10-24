import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getConfig } from '@/lib/factory/config'
import { isAdmin } from '@/lib/factory/session'
import { LoginForm } from '../_components/login-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Admin login' }

export default async function LoginPage() {
  if (await isAdmin()) redirect('/factory')
  const enabled = getConfig().admin !== null
  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl">Admin login</h1>
      {enabled ? (
        <>
          <p className="mt-2 text-fg-muted">
            The admin can start production runs that publish to the Hoverline site, with no daily
            run limit.
          </p>
          <LoginForm />
        </>
      ) : (
        <p className="mt-2 text-fg-muted">
          Admin login is off. Set <code>FACTORY_ADMIN_PASSWORD</code> and{' '}
          <code>SESSION_SECRET</code> in the environment to turn it on.
        </p>
      )}
    </main>
  )
}
