'use client'

import { useActionState, useEffect, useId, useRef } from 'react'
import type { BlockProps } from '@pageforge/blocks'
import { Button } from '../primitives/button'
import { Field, Input, Select, Textarea } from '../primitives/field'
import { siteLabels } from '../site-labels'
import { BlockSection, headingId, SectionHeading } from './shared'
import type { BlockExtras, DemoFormState } from './types'

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

const initialState: DemoFormState = { status: 'idle' }

/** Loads the Turnstile script once; the widget renders itself into `.cf-turnstile`. */
function useTurnstileScript(siteKey: string | undefined) {
  useEffect(() => {
    if (!siteKey || typeof document === 'undefined') return
    if (document.querySelector(`script[src^="${TURNSTILE_SRC}"]`)) return
    const s = document.createElement('script')
    s.src = TURNSTILE_SRC
    s.async = true
    s.defer = true
    document.head.appendChild(s)
  }, [siteKey])
}

function Turnstile({ siteKey }: { siteKey: string }) {
  useTurnstileScript(siteKey)
  // Turnstile adds a hidden input named `cf-turnstile-response` inside this div.
  return (
    <div
      className="cf-turnstile min-h-[65px]"
      data-sitekey={siteKey}
      data-response-field-name="cf-turnstile-response"
      data-theme="auto"
      data-size="flexible"
    />
  )
}

type FormProps = {
  action?: (prev: DemoFormState, formData: FormData) => Promise<DemoFormState>
  turnstileSiteKey?: string
  submitLabel: string
}

/** Falls back to a no-op action so the hook order never changes. */
async function noAction(prev: DemoFormState): Promise<DemoFormState> {
  return prev
}

function DemoFormFields({ action, turnstileSiteKey, submitLabel }: FormProps) {
  const [state, formAction, pending] = useActionState(action ?? noAction, initialState)
  const uid = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const errors = state.fieldErrors ?? {}
  const disabled = !action

  // After a failed submit, move focus to the first field with an error;
  // after success, move focus to the confirmation.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      const first = Object.keys(state.fieldErrors)[0]
      const el = first ? formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`) : null
      el?.focus()
    } else if (state.status === 'success') {
      statusRef.current?.focus()
    }
  }, [state])

  if (state.status === 'success') {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className="self-start rounded-media border border-line bg-surface-raised p-6 outline-none sm:p-8"
      >
        <svg viewBox="0 0 120 28" width="120" height="28" aria-hidden="true" className="block">
          <path
            d="M8 18 C 30 4, 60 26, 100 12"
            className="fill-none stroke-accent"
            strokeWidth="2.5"
          />
          <rect x="0" y="12" width="12" height="12" className="fill-fg" />
          <rect x="102" y="4" width="12" height="12" className="fill-fg" />
        </svg>
        <p className="mt-5 text-title font-semibold text-fg [font-stretch:112%]">
          Request received
        </p>
        <p className="mt-3 max-w-[44ch] text-base text-fg">
          {state.message ??
            'A site engineer will email you within one working day to arrange the walk-through.'}
        </p>
      </div>
    )
  }

  const id = (n: string) => `${uid}-${n}`
  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="grid gap-x-5 gap-y-5 rounded-media border border-line bg-surface-raised p-5 sm:grid-cols-2 sm:p-8"
      aria-describedby={disabled ? id('disabled') : undefined}
    >
      <Field id={id('name')} label="Name" error={errors.name}>
        {(a) => (
          <Input
            {...a}
            name="name"
            autoComplete="name"
            required
            disabled={disabled}
            placeholder="Dana Reyes…"
          />
        )}
      </Field>
      <Field id={id('email')} label="Work email" error={errors.email}>
        {(a) => (
          <Input
            {...a}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            disabled={disabled}
            placeholder="dana@operator.com…"
          />
        )}
      </Field>
      <Field id={id('company')} label="Company" error={errors.company}>
        {(a) => (
          <Input {...a} name="company" autoComplete="organization" required disabled={disabled} />
        )}
      </Field>
      <Field id={id('role')} label="Role" error={errors.role} optional>
        {(a) => (
          <Input
            {...a}
            name="role"
            autoComplete="organization-title"
            disabled={disabled}
            placeholder="Reliability engineer…"
          />
        )}
      </Field>
      <Field
        id={id('siteType')}
        label="Site type"
        error={errors.siteType}
        className="sm:col-span-2"
      >
        {(a) => (
          <Select {...a} name="siteType" defaultValue="" required disabled={disabled}>
            <option value="" disabled>
              Choose a site type…
            </option>
            {Object.entries(siteLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="other">Something else</option>
          </Select>
        )}
      </Field>
      <Field
        id={id('message')}
        label="What should the drone look at?"
        error={errors.message}
        optional
        className="sm:col-span-2"
      >
        {(a) => (
          <Textarea
            {...a}
            name="message"
            rows={4}
            disabled={disabled}
            placeholder="Twelve floating-roof tanks, one flare, permits renew in March…"
          />
        )}
      </Field>

      {turnstileSiteKey && !disabled ? (
        <div className="sm:col-span-2">
          <Turnstile siteKey={turnstileSiteKey} />
          {errors['cf-turnstile-response'] ? (
            <p className="mt-1.5 text-sm font-medium text-danger">
              {errors['cf-turnstile-response']}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm">
          {state.status === 'error' && state.message ? (
            <p className="font-medium text-danger">{state.message}</p>
          ) : null}
          {disabled ? (
            <p id={id('disabled')} className="text-fg-muted">
              This form is not connected here. On the live site it books a walk-through.
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={disabled || pending} aria-busy={pending || undefined}>
          {pending ? 'Sending…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/**
 * The closing block when the goal is a demo: the promise on the left (what
 * happens after they submit, as a short route of next steps), the form on
 * the right.
 */
export function DemoForm(props: BlockProps<'demoForm'> & BlockExtras) {
  const { _key, heading, body, submitLabel, nextSteps, context } = props
  return (
    <BlockSection block={props} field="shade">
      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <SectionHeading id={headingId(_key)} text={heading} column="narrow" />
          <p className="mt-6 max-w-[44ch] text-lead text-fg">{body}</p>
          <h3 className="mt-10 text-sm font-semibold text-fg [font-stretch:100%]">
            After you send this
          </h3>
          <ol className="mt-4 flex flex-col">
            {nextSteps.map((s, i) => {
              const last = i === nextSteps.length - 1
              return (
                <li key={s} className="relative grid grid-cols-[18px_1fr] gap-x-4 pb-5 last:pb-0">
                  {last ? null : (
                    <span
                      aria-hidden="true"
                      className="absolute top-3 bottom-0 left-[7.5px] w-[3px] bg-accent"
                    />
                  )}
                  <span aria-hidden="true" className="relative mt-1 block size-[18px]">
                    {last ? (
                      <span className="absolute inset-0.5 block bg-fg" />
                    ) : (
                      <span className="absolute inset-0 block rounded-full border-[3px] border-accent bg-surface" />
                    )}
                  </span>
                  <span className="text-base text-fg">{s}</span>
                </li>
              )
            })}
          </ol>
        </div>
        <DemoFormFields
          action={context?.demoFormAction}
          turnstileSiteKey={context?.turnstileSiteKey}
          submitLabel={submitLabel}
        />
      </div>
    </BlockSection>
  )
}
