'use client'

import { useRouter } from 'next/navigation'
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  audienceSuggestions,
  exampleBriefs,
  goalLabels,
  siteTypeLabels,
} from '@/lib/factory/brief-data'
import { Turnstile } from './turnstile'

type SiteType = keyof typeof siteTypeLabels
type Goal = keyof typeof goalLabels

interface Props {
  turnstileSiteKey: string | null
  canProduction: boolean
  remaining: number
}

const inputClass =
  'w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-base placeholder:text-fg-muted/70 focus-visible:border-accent'

export function BriefForm({ turnstileSiteKey, canProduction, remaining }: Props) {
  const router = useRouter()
  const ids = { prospect: useId(), audience: useId(), notes: useId(), notesHelp: useId() }
  const [prospect, setProspect] = useState('')
  const [siteType, setSiteType] = useState<SiteType>('refinery')
  const [audience, setAudience] = useState<string[]>([])
  const [draftRole, setDraftRole] = useState('')
  const [goal, setGoal] = useState<Goal>('book-demo')
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<'demo' | 'production'>('demo')
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const exampleIndex = useRef(0)
  const roleInput = useRef<HTMLInputElement>(null)

  function addRole(raw: string) {
    const role = raw.trim().replace(/\s+/g, ' ')
    if (!role) return
    if (role.length > 40) {
      setErrors((e) => ({ ...e, audience: 'Keep each role under 40 characters.' }))
      return
    }
    if (audience.some((a) => a.toLowerCase() === role.toLowerCase())) {
      setDraftRole('')
      return
    }
    if (audience.length >= 4) {
      setErrors((e) => ({ ...e, audience: 'Pick up to four audience roles.' }))
      return
    }
    setAudience((a) => [...a, role])
    setDraftRole('')
    setErrors((e) => {
      const rest = { ...e }
      delete rest.audience
      return rest
    })
  }

  function onRoleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addRole(draftRole)
    } else if (e.key === 'Backspace' && !draftRole && audience.length) {
      setAudience((a) => a.slice(0, -1))
    }
  }

  function fillExample() {
    const ex = exampleBriefs[exampleIndex.current % exampleBriefs.length]!
    exampleIndex.current++
    setProspect(ex.prospect)
    setSiteType(ex.siteType)
    setAudience([...ex.audience])
    setGoal(ex.goal)
    setNotes(ex.notes ?? '')
    setErrors({})
    setFormError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const roles = draftRole.trim() ? [...audience, draftRole.trim()] : audience
    setFormError(null)
    if (turnstileSiteKey && !token) {
      setFormError('Complete the human check above the button, then submit again.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/factory/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prospect,
          siteType,
          audience: roles,
          goal,
          notes: notes.trim() || undefined,
          turnstileToken: token ?? undefined,
          mode: canProduction ? mode : undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        runId?: string
        error?: string
        fieldErrors?: Record<string, string>
      }
      if (res.ok && data.runId) {
        router.push(`/factory/runs/${data.runId}`)
        router.refresh() // header quota lives in the layout
        return
      }
      setErrors(data.fieldErrors ?? {})
      setFormError(data.error ?? `The server answered ${res.status}. Try again in a moment.`)
      if (turnstileSiteKey) setResetKey((k) => k + 1)
    } catch {
      setFormError('Could not reach the server. Check your connection and submit again.')
    }
    setPending(false)
  }

  const err = (k: string) =>
    errors[k] ? (
      <p id={`${k}-error`} className="mt-1.5 border-l-2 border-signal pl-2 text-sm">
        {errors[k]}
      </p>
    ) : null

  const outOfRuns = remaining <= 0 && !canProduction

  return (
    <form onSubmit={submit} noValidate aria-describedby={formError ? 'form-error' : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg">Sales brief</h2>
        <button
          type="button"
          onClick={fillExample}
          className="text-sm underline decoration-line underline-offset-4 hover:decoration-fg"
        >
          Try an example brief
        </button>
      </div>

      <div className="mt-5 space-y-6">
        <div>
          <label htmlFor={ids.prospect} className="block font-semibold">
            Prospect
          </label>
          <p className="mt-0.5 text-sm text-fg-muted">
            Who the page is for, in a sales rep&rsquo;s words.
          </p>
          <input
            id={ids.prospect}
            name="prospect"
            value={prospect}
            onChange={(e) => setProspect(e.target.value)}
            maxLength={120}
            required
            autoComplete="off"
            placeholder="Gulf Coast refinery running rope-access tank inspections"
            aria-invalid={Boolean(errors.prospect)}
            aria-describedby={errors.prospect ? 'prospect-error' : undefined}
            className={`${inputClass} mt-2`}
          />
          {err('prospect')}
        </div>

        <fieldset>
          <legend className="font-semibold">Site type</legend>
          <div className="mt-2 grid grid-cols-3 rounded-control border border-line bg-surface-raised p-0.5">
            {(Object.keys(siteTypeLabels) as SiteType[]).map((s) => (
              <label
                key={s}
                className="relative cursor-pointer rounded-[2px] px-2 py-1.5 text-center text-sm has-[:checked]:bg-fg has-[:checked]:text-surface has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                <input
                  type="radio"
                  name="siteType"
                  value={s}
                  checked={siteType === s}
                  onChange={() => setSiteType(s)}
                  className="sr-only"
                />
                {siteTypeLabels[s]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={ids.audience} className="block font-semibold">
            Audience
          </label>
          <p className="mt-0.5 text-sm text-fg-muted">
            Up to four job titles. Press Enter to add one.
          </p>
          <div
            className="mt-2 flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border border-line bg-surface-raised px-2 py-1.5 focus-within:border-accent"
            onClick={() => roleInput.current?.focus()}
          >
            <ul className="contents" aria-label="Selected audience roles">
              {audience.map((a) => (
                <li
                  key={a}
                  className="flex items-center gap-1 rounded-control border border-line bg-surface py-0.5 pr-0.5 pl-2 text-sm"
                >
                  {a}
                  <button
                    type="button"
                    onClick={() => setAudience((list) => list.filter((x) => x !== a))}
                    className="grid size-6 place-items-center rounded-[2px] text-fg-muted hover:bg-surface-raised hover:text-fg"
                    aria-label={`Remove ${a}`}
                  >
                    <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <input
              ref={roleInput}
              id={ids.audience}
              value={draftRole}
              onChange={(e) => setDraftRole(e.target.value)}
              onKeyDown={onRoleKey}
              onBlur={() => draftRole.trim() && addRole(draftRole)}
              maxLength={40}
              disabled={audience.length >= 4}
              placeholder={audience.length ? '' : 'Reliability engineer'}
              aria-invalid={Boolean(errors.audience)}
              aria-describedby={errors.audience ? 'audience-error' : undefined}
              className="min-w-32 flex-1 bg-transparent px-1 py-1 text-base outline-none placeholder:text-fg-muted/70 disabled:hidden"
            />
          </div>
          {audience.length < 4 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-fg-muted">Suggestions:</span>
              {audienceSuggestions
                .filter((s) => !audience.includes(s))
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addRole(s)}
                    className="rounded-control border border-dashed border-line px-2 py-0.5 hover:border-fg-muted"
                  >
                    {s}
                  </button>
                ))}
            </div>
          )}
          {err('audience')}
        </div>

        <fieldset>
          <legend className="font-semibold">Goal</legend>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {(Object.keys(goalLabels) as Goal[]).map((g) => (
              <label
                key={g}
                className="flex cursor-pointer items-center gap-2 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm has-[:checked]:border-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                <input
                  type="radio"
                  name="goal"
                  value={g}
                  checked={goal === g}
                  onChange={() => setGoal(g)}
                  className="accent-[var(--accent)]"
                />
                {goalLabels[g]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={ids.notes} className="font-semibold">
              Notes <span className="font-normal text-fg-muted">(optional)</span>
            </label>
            <span id={ids.notesHelp} className="text-xs text-fg-muted tabular-nums">
              {notes.length} / 600
            </span>
          </div>
          <textarea
            id={ids.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={600}
            rows={4}
            placeholder="What the prospect said on the call, what they use today, the objection to answer."
            aria-describedby={`${ids.notesHelp}${errors.notes ? ' notes-error' : ''}`}
            aria-invalid={Boolean(errors.notes)}
            className={`${inputClass} mt-2 resize-y`}
          />
          {err('notes')}
        </div>

        {canProduction && (
          <fieldset>
            <legend className="font-semibold">Publish to</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'demo'}
                  onChange={() => setMode('demo')}
                  className="accent-[var(--accent)]"
                />
                Demo sandbox
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'production'}
                  onChange={() => setMode('production')}
                  className="accent-[var(--accent)]"
                />
                Production site (Sanity)
              </label>
            </div>
          </fieldset>
        )}

        {turnstileSiteKey && (
          <Turnstile siteKey={turnstileSiteKey} onToken={setToken} resetKey={resetKey} />
        )}

        {formError && (
          <p
            id="form-error"
            role="alert"
            className="border-l-2 border-signal bg-surface-raised px-3 py-2 text-sm"
          >
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={pending || outOfRuns}
            className="rounded-control bg-accent px-5 py-2.5 font-semibold text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Starting the run…' : 'Build the page'}
          </button>
          <p className="text-sm text-fg-muted">
            {outOfRuns
              ? 'No runs left today on this network. Runs reset at 00:00 UTC.'
              : 'Plan, copy, QA and fixes take about a minute.'}
          </p>
        </div>
      </div>
    </form>
  )
}
