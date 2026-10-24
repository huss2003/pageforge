import Link from 'next/link'
import { logoutAction } from '@/lib/factory/admin'
import type { FactoryMode } from '@/lib/factory/orchestrator'
import { RouteMark } from './route-mark'

interface Quota {
  remaining: number
  ipUsed: number
  ipCap: number
  globalUsed: number
  globalCap: number
}

export function FactoryHeader({
  mode,
  quota,
  admin,
}: {
  mode: FactoryMode
  quota: Quota
  admin: boolean
}) {
  const simulated = mode.models === 'simulated'
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/factory" className="flex items-center gap-2 rounded-control">
          <RouteMark className="size-6" />
          <span className="font-bold [font-stretch:125%]">PageForge</span>
          <span className="text-fg-muted">Factory</span>
        </Link>

        <nav aria-label="Factory" className="order-last flex gap-1 text-sm sm:order-none">
          <Link href="/factory" className="rounded-control px-2 py-1 hover:bg-surface-raised">
            Build
          </Link>
          <Link href="/factory/runs" className="rounded-control px-2 py-1 hover:bg-surface-raised">
            Runs
          </Link>
          <Link
            href="/"
            className="rounded-control px-2 py-1 text-fg-muted hover:bg-surface-raised"
          >
            Hoverline site
          </Link>
        </nav>

        <dl className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:ml-auto sm:w-auto">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Mode</dt>
            <dd
              className="flex items-center gap-1.5"
              title={
                simulated
                  ? 'No model keys are set: a scripted model writes the page and QA is simulated from the page content.'
                  : mode.qa === 'live'
                    ? 'Gemini or Groq writes the page; Lighthouse and axe run in GitHub Actions.'
                    : 'Gemini or Groq writes the page; QA is simulated from the page content.'
              }
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${simulated ? 'border border-fg-muted' : 'bg-accent'}`}
              />
              {simulated ? 'Simulation' : 'Live models'}
              {!simulated && mode.qa === 'simulated' && (
                <span className="text-fg-muted">, simulated QA</span>
              )}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-fg-muted">{admin ? 'Demo runs today' : 'Runs left today'}</dt>
            <dd className="tabular-nums">
              {admin ? (
                <>
                  {quota.globalUsed}
                  <span className="text-fg-muted"> of {quota.globalCap}</span>
                </>
              ) : (
                <>
                  {quota.remaining}
                  <span className="text-fg-muted"> of {quota.ipCap}</span>
                </>
              )}
            </dd>
          </div>
          {mode.adminEnabled && (
            <div>
              <dt className="sr-only">Admin</dt>
              <dd>
                {admin ? (
                  <form action={logoutAction} className="flex items-center gap-2">
                    <span>Admin</span>
                    <button
                      type="submit"
                      className="text-fg-muted underline underline-offset-4 hover:text-fg"
                    >
                      Log out
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/factory/login"
                    className="text-fg-muted underline underline-offset-4 hover:text-fg"
                  >
                    Admin login
                  </Link>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>
      {mode.storage === 'memory' && (
        <p className="border-t border-line px-4 py-1.5 text-center text-xs text-fg-muted sm:px-6">
          Runs are kept in this server&rsquo;s memory because Supabase is not connected. They reset
          when the server restarts.
        </p>
      )}
    </header>
  )
}
