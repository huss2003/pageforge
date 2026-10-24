'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  ApiError,
  endSession,
  fixturesEnabled,
  getSession,
  resetFixtures,
  startSession,
  type Session,
} from '@/lib/abm/client'
import type { Role } from '@/lib/abm/types'
import { roleLabels } from './labels'
import { RouteMark } from './marks'
import { SessionGate } from './session-gate'
import { ErrorNote, Skeleton } from './ui'

interface SessionContextValue {
  session: Session
  /** Demo workspace only: act as another role. */
  switchRole: (role: Role) => Promise<void>
  can: (...roles: Role[]) => boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function useDeskSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useDeskSession must be used inside <DeskShell>')
  return ctx
}

const nav = [
  {
    href: '/abm',
    label: 'Account pages',
    match: (p: string) => p === '/abm' || p.startsWith('/abm/campaigns') || p === '/abm/new',
  },
  { href: '/abm/overview', label: 'Overview', match: (p: string) => p.startsWith('/abm/overview') },
  { href: '/abm/leads', label: 'Leads', match: (p: string) => p.startsWith('/abm/leads') },
]

const switchable: Exclude<Role, 'admin'>[] = ['marketer', 'sales', 'reviewer']

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/abm'
  // The preview iframe renders only the page; it carries no desk chrome or session check.
  if (pathname === '/abm/preview') return <>{children}</>
  return <Desk pathname={pathname}>{children}</Desk>
}

function Desk({ children, pathname }: { children: ReactNode; pathname: string }) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'none' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; session: Session }
  >({ kind: 'loading' })
  const [switching, setSwitching] = useState<Role | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await getSession()
      setState(s ? { kind: 'ready', session: s } : { kind: 'none' })
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Could not load the session.',
      })
    }
  }, [])

  useEffect(() => {
    // Session lives in an httpOnly cookie, so the desk asks the API once on load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const switchRole = useCallback(
    async (role: Role) => {
      if (state.kind !== 'ready' || state.session.role === role) return
      setSwitching(role)
      setSwitchError(null)
      try {
        await startSession({ role, workspace: 'demo' })
        setState({ kind: 'ready', session: { ...state.session, role } })
      } catch (e) {
        setSwitchError(e instanceof ApiError ? e.message : 'Could not switch role.')
      }
      setSwitching(null)
    },
    [state],
  )

  async function signOut() {
    try {
      await endSession()
    } catch {
      // The cookie may already be gone; show the gate either way.
    }
    setState({ kind: 'none' })
  }

  const session = state.kind === 'ready' ? state.session : null
  const demo = session?.workspace === 'demo'

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link href="/abm" className="flex items-center gap-2 rounded-control py-1">
            <RouteMark className="size-6" />
            <span className="font-bold [font-stretch:125%]">PageForge</span>
            <span className="text-fg-muted">ABM</span>
          </Link>

          {session && (
            <nav
              aria-label="Desk"
              className="order-last -mx-1 flex w-full gap-0.5 overflow-x-auto text-sm md:order-none md:w-auto"
            >
              {nav.map((n) => {
                const current = n.match(pathname)
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={current ? 'page' : undefined}
                    className="rounded-control px-2.5 py-1.5 whitespace-nowrap text-fg-muted hover:text-fg aria-[current=page]:bg-[color-mix(in_oklab,var(--line)_45%,transparent)] aria-[current=page]:text-fg"
                  >
                    {n.label}
                  </Link>
                )
              })}
            </nav>
          )}

          {session && (
            <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm sm:ml-auto sm:w-auto sm:justify-start sm:gap-x-4">
              <span
                className="flex items-center gap-1.5"
                title={
                  session.liveModels
                    ? 'Drafts are written by Gemini or Groq; the validator checks every claim.'
                    : 'No model keys are set: a scripted model writes drafts, including one unsupported claim for the reviewer to catch.'
                }
              >
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${session.liveModels ? 'bg-accent' : 'border border-fg-muted'}`}
                />
                {session.liveModels ? 'Live models' : 'Simulation'}
              </span>
              <span className="hidden text-fg-muted sm:inline">
                {demo ? 'Demo workspace' : 'Main workspace'}
              </span>
              {demo ? (
                <div role="group" aria-label="Act as" className="flex items-center gap-2">
                  <span className="hidden text-fg-muted lg:inline">Act as</span>
                  <div className="flex rounded-control border border-line p-0.5">
                    {switchable.map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={session.role === r}
                        disabled={switching !== null}
                        onClick={() => switchRole(r)}
                        className="rounded-[2px] px-2 py-1 text-xs font-medium text-fg-muted hover:text-fg aria-pressed:bg-fg aria-pressed:text-surface disabled:cursor-wait"
                      >
                        {switching === r ? (
                          'Switching…'
                        ) : r === 'sales' ? (
                          <>
                            <span className="sm:hidden">Sales</span>
                            <span className="hidden sm:inline">{roleLabels[r]}</span>
                          </>
                        ) : (
                          roleLabels[r]
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <span>{roleLabels[session.role]}</span>
              )}
              <button
                type="button"
                onClick={signOut}
                className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
              >
                Leave
              </button>
            </div>
          )}
        </div>
        {switchError && (
          <div className="mx-auto max-w-[96rem] px-4 pb-2 sm:px-6">
            <ErrorNote>{switchError}</ErrorNote>
          </div>
        )}
      </header>

      <div className="flex-1">
        {state.kind === 'loading' && (
          <div className="mx-auto max-w-[96rem] space-y-3 px-4 py-8 sm:px-6" aria-busy="true">
            <span className="sr-only">Loading the desk</span>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        )}
        {state.kind === 'error' && (
          <div className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6">
            <ErrorNote onRetry={load}>{state.message}</ErrorNote>
          </div>
        )}
        {state.kind === 'none' && (
          <SessionGate onReady={(s) => setState({ kind: 'ready', session: s })} />
        )}
        {session && (
          <SessionContext.Provider
            value={{
              session,
              switchRole,
              can: (...roles) => session.role === 'admin' || roles.includes(session.role),
            }}
          >
            {children}
          </SessionContext.Provider>
        )}
      </div>

      {fixturesEnabled() && (
        <footer className="border-t border-line px-4 py-2 text-xs text-fg-muted sm:px-6">
          Fixture mode: the desk answers from sample data kept in this browser.{' '}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-fg"
            onClick={() => {
              resetFixtures()
              window.location.reload()
            }}
          >
            Reset sample data
          </button>
        </footer>
      )}
    </div>
  )
}
