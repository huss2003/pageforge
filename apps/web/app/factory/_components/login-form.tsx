'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from '@/lib/factory/admin'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {})
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="block font-semibold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? 'login-error' : undefined}
          className="mt-2 w-full rounded-control border border-line bg-surface-raised px-3 py-2"
        />
      </div>
      {state.error && (
        <p id="login-error" role="alert" className="border-l-2 border-signal pl-2 text-sm">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-control bg-fg px-5 py-2.5 font-semibold text-surface disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'Log in'}
      </button>
    </form>
  )
}
