'use client'

import { useId, useState, type FormEvent } from 'react'
import { ApiError, getSession, startSession, type Session } from '@/lib/abm/client'
import type { Role } from '@/lib/abm/types'
import { roleHelp, roleLabels } from './labels'
import { Button, FieldError, inputClass } from './ui'

const roles: Exclude<Role, 'admin'>[] = ['marketer', 'reviewer', 'sales']

/** No session yet: pick a role in the demo workspace, or unlock the main one. */
export function SessionGate({ onReady }: { onReady: (s: Session) => void }) {
  const pwId = useId()
  const [pending, setPending] = useState<Role | 'main' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)

  async function enter(role: Role, workspace: 'demo' | 'main', pw?: string) {
    setPending(workspace === 'main' ? 'main' : role)
    setError(null)
    setPwError(null)
    try {
      const res = await startSession({ role, workspace, password: pw })
      const full = await getSession().catch(() => null)
      onReady(full ?? { ...res, liveModels: false })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not start a session.'
      if (workspace === 'main') setPwError(e instanceof ApiError ? (e.fields.password ?? msg) : msg)
      else setError(msg)
      setPending(null)
    }
  }

  function unlock(e: FormEvent) {
    e.preventDefault()
    if (!password) {
      setPwError('Enter the workspace password.')
      return
    }
    void enter('admin', 'main', password)
  }

  return (
    <main className="mx-auto max-w-[44rem] px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-xl">Account pages desk</h1>
      <p className="mt-2 max-w-[60ch] text-fg-muted">
        Turn an account brief into a Hoverline page where every claim has a source, a reviewer signs
        off and engagement reaches sales. The demo workspace is a sandbox: pick a role to start, and
        switch roles from the header at any time.
      </p>

      <section aria-labelledby="demo-heading" className="mt-8">
        <h2 id="demo-heading" className="text-sm font-semibold [font-stretch:100%]">
          Demo workspace
        </h2>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {roles.map((r) => (
            <li
              key={r}
              className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">{roleLabels[r]}</p>
                <p className="text-sm text-fg-muted">{roleHelp[r]}</p>
              </div>
              <Button
                variant={r === 'marketer' ? 'primary' : 'secondary'}
                onClick={() => enter(r, 'demo')}
                pending={pending === r}
                pendingLabel="Opening…"
                disabled={pending !== null}
                className="sm:w-40"
              >
                Continue as {roleLabels[r].toLowerCase()}
              </Button>
            </li>
          ))}
        </ul>
        {error && <FieldError id="gate-error">{error}</FieldError>}
        <p className="mt-2 text-xs text-fg-muted">
          Every action is written to the audit log with the role that took it. Demo data older than
          7 days is cleared.
        </p>
      </section>

      <section aria-labelledby="main-heading" className="mt-10">
        <h2 id="main-heading" className="text-sm font-semibold [font-stretch:100%]">
          Main workspace
        </h2>
        <form onSubmit={unlock} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label htmlFor={pwId} className="sr-only">
              Workspace password
            </label>
            <input
              id={pwId}
              type="password"
              autoComplete="current-password"
              placeholder="Workspace password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(pwError)}
              aria-describedby={pwError ? `${pwId}-err` : undefined}
              className={`${inputClass} h-10`}
            />
            <FieldError id={`${pwId}-err`}>{pwError}</FieldError>
          </div>
          <Button
            type="submit"
            pending={pending === 'main'}
            pendingLabel="Checking…"
            disabled={pending !== null}
          >
            Unlock
          </Button>
        </form>
      </section>
    </main>
  )
}
