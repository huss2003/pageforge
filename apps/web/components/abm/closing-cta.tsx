'use client'

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, bookMeeting, getSlots, submitLead } from '@/lib/abm/client'
import { getActiveTracker } from '@/lib/abm/tracking'
import type { CtaConfig } from '@/lib/abm/types'
import { describeSlot, groupSlotsByDay, localTimeZone, type SlotDay } from './slots'
import { Turnstile } from './turnstile'

export interface ClosingCtaProps {
  heading: string
  body?: string
  nextSteps?: string[]
  cta: CtaConfig
  campaignId: string | null
  versionId: string | null
  /** False in the desk preview: shows the layout without fetching or submitting. */
  interactive: boolean
  turnstileSiteKey?: string
  /** Prefills the company field for a one-account page. */
  accountName?: string | null
}

const field =
  'mt-1 w-full rounded-control border border-[color-mix(in_oklab,var(--line)_55%,var(--fg))] bg-surface px-3 py-2.5 text-base text-fg placeholder:text-fg-muted/80 focus-visible:border-accent aria-[invalid=true]:border-signal'

const primary =
  'inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60'

function Input({
  id,
  label,
  error,
  hint,
  ...rest
}: {
  id: string
  label: string
  error?: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {hint && <p className="text-xs text-fg-muted">{hint}</p>}
      <input
        id={id}
        name={id.split('-').at(-1)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
        className={field}
        {...rest}
      />
      {error && (
        <p id={`${id}-err`} className="mt-1 border-l-2 border-signal pl-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

function useFormStart(form: string) {
  return () => {
    getActiveTracker()?.formStart(form)
  }
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-media border border-line bg-surface p-5 sm:p-6">
      <h3 className="text-base font-semibold [font-stretch:100%]">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Success({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="border-l-2 border-accent pl-4 outline-none"
    >
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-fg-muted">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

function SlotPicker(props: ClosingCtaProps) {
  const uid = useId()
  const [tz, setTz] = useState('UTC')
  const [days, setDays] = useState<SlotDay[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dayKey, setDayKey] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [values, setValues] = useState({ name: '', email: '', company: props.accountName ?? '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [booked, setBooked] = useState<string | null>(null)
  const onStart = useFormStart('meeting')
  const formRef = useRef<HTMLFormElement>(null)

  async function load() {
    setLoadError(null)
    const zone = localTimeZone()
    setTz(zone)
    try {
      const slots = await getSlots(props.campaignId)
      const grouped = groupSlotsByDay(slots, zone)
      setDays(grouped)
      setDayKey((k) => k ?? grouped[0]?.key ?? null)
    } catch {
      setLoadError('The calendar did not load.')
    }
  }

  useEffect(() => {
    if (!props.interactive) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.interactive])

  useEffect(() => {
    if (slot) formRef.current?.querySelector('input')?.focus()
  }, [slot])

  const day = days?.find((d) => d.key === dayKey) ?? null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!slot || pending) return
    const errs: Record<string, string> = {}
    if (!values.name.trim()) errs.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      errs.email = 'Enter a work email address.'
    if (!values.company.trim()) errs.company = 'Enter your company.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (props.turnstileSiteKey && !token) {
      setFormError('Complete the check above the button, then book again.')
      return
    }
    setPending(true)
    setFormError(null)
    const tracker = getActiveTracker()
    try {
      await bookMeeting({
        campaignId: props.campaignId,
        visitorId: tracker?.visitorId ?? 'anonymous',
        slotStart: slot,
        timezone: tz,
        name: values.name.trim(),
        email: values.email.trim(),
        company: values.company.trim(),
        turnstileToken: token,
      })
      tracker?.track('form_submit', { form: 'meeting' })
      tracker?.track('meeting_booked', { slot, timezone: tz })
      setBooked(slot)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields)
        setFormError(err.message)
        if (err.status === 409) {
          setSlot(null)
          void load()
        }
      } else setFormError('Could not book the meeting. Check your connection and try again.')
      if (props.turnstileSiteKey) setResetKey((k) => k + 1)
    }
    setPending(false)
  }

  if (!props.interactive) {
    return (
      <Panel title="Pick a time">
        <p className="text-sm text-fg-muted">
          Visitors choose a 30-minute slot over the next 10 working days, shown in their own time
          zone, then leave their name, work email and company.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden="true">
          {['10:00', '10:30', '11:00', '14:30', '15:00', '15:30', '16:00', '16:30'].map((t) => (
            <span
              key={t}
              className="rounded-control border border-line py-2 text-center text-sm tabular-nums text-fg-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </Panel>
    )
  }

  if (booked) {
    return (
      <Panel title="Meeting booked">
        <Success title={describeSlot(booked, tz)}>
          A calendar invite is on its way to {values.email}. To change the time, reply to it.
        </Success>
      </Panel>
    )
  }

  return (
    <Panel title={slot ? 'Your details' : 'Pick a time'}>
      {!slot && (
        <>
          <p className="text-sm text-fg-muted">
            30 minutes. Times are in <span className="text-fg">{tz.replace(/_/g, ' ')}</span>.
          </p>
          {loadError && (
            <p role="alert" className="mt-3 border-l-2 border-signal pl-2 text-sm">
              {loadError}{' '}
              <button
                type="button"
                onClick={load}
                className="font-semibold underline underline-offset-4"
              >
                Try again
              </button>
            </p>
          )}
          {!days && !loadError && (
            <p className="mt-4 text-sm text-fg-muted" aria-live="polite">
              Loading open times…
            </p>
          )}
          {days && days.length === 0 && (
            <p className="mt-4 text-sm">
              No open times in the next two weeks. Use the form link below to write to us instead.
            </p>
          )}
          {days && days.length > 0 && (
            <>
              <div
                role="group"
                aria-label="Day"
                className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1"
              >
                {days.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={d.key === dayKey}
                    onClick={() => setDayKey(d.key)}
                    className="shrink-0 rounded-control border border-line px-3 py-2 text-sm whitespace-nowrap hover:border-fg aria-pressed:border-fg aria-pressed:bg-fg aria-pressed:text-surface"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {day && (
                <div
                  role="group"
                  aria-label={`Times on ${day.label}`}
                  className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4"
                >
                  {day.slots.map((s) => (
                    <button
                      key={s.iso}
                      type="button"
                      onClick={() => {
                        setSlot(s.iso)
                        getActiveTracker()?.track('cta_click', { action: 'slot', slot: s.iso })
                      }}
                      className="min-h-11 rounded-control border border-[color-mix(in_oklab,var(--line)_55%,var(--fg))] text-sm tabular-nums hover:border-accent hover:text-accent"
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <p className="mt-4 text-xs text-fg-muted">
            Demo calendar: bookings go to a sample Hoverline diary.
          </p>
        </>
      )}

      {slot && (
        <form
          ref={formRef}
          onSubmit={submit}
          onFocus={onStart}
          noValidate
          className="space-y-4"
          data-form="meeting"
        >
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-semibold">{describeSlot(slot, tz)}</span>
            <button
              type="button"
              onClick={() => setSlot(null)}
              className="text-fg-muted underline underline-offset-4 hover:text-fg"
            >
              Change time
            </button>
          </p>
          <Input
            id={`${uid}-name`}
            label="Name"
            autoComplete="name"
            value={values.name}
            error={errors.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            maxLength={80}
          />
          <Input
            id={`${uid}-email`}
            label="Work email"
            type="email"
            autoComplete="email"
            value={values.email}
            error={errors.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            maxLength={160}
          />
          <Input
            id={`${uid}-company`}
            label="Company"
            autoComplete="organization"
            value={values.company}
            error={errors.company}
            onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
            maxLength={80}
          />
          {props.turnstileSiteKey && (
            <Turnstile siteKey={props.turnstileSiteKey} onToken={setToken} resetKey={resetKey} />
          )}
          {formError && (
            <p role="alert" className="border-l-2 border-signal pl-2 text-sm">
              {formError}
            </p>
          )}
          <button type="submit" disabled={pending} className={`${primary} w-full`}>
            {pending ? 'Booking…' : props.cta.label}
          </button>
        </form>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Lead form
// ---------------------------------------------------------------------------

const extraFields: Record<
  CtaConfig['formFields'][number],
  { label: string; type?: string; autoComplete?: string; max: number }
> = {
  role: { label: 'Role', autoComplete: 'organization-title', max: 80 },
  phone: { label: 'Phone', type: 'tel', autoComplete: 'tel', max: 40 },
  siteCount: { label: 'Number of sites', type: 'number', max: 6 },
  message: { label: 'Anything we should know', max: 600 },
}

function LeadForm(props: ClosingCtaProps) {
  const uid = useId()
  const fields = useMemo(
    () => ['name', 'email', 'company', ...props.cta.formFields] as string[],
    [props.cta.formFields],
  )
  const [values, setValues] = useState<Record<string, string>>({ company: props.accountName ?? '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [done, setDone] = useState(false)
  const onStart = useFormStart('lead')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!props.interactive || pending) return
    const v = Object.fromEntries(
      Object.entries(values)
        .map(([k, x]) => [k, x.trim()])
        .filter(([, x]) => x),
    )
    const errs: Record<string, string> = {}
    if (!v.name) errs.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email ?? ''))
      errs.email = 'Enter a work email address.'
    if (!v.company) errs.company = 'Enter your company.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`${uid}-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    if (props.turnstileSiteKey && !token) {
      setFormError('Complete the check above the button, then send again.')
      return
    }
    setPending(true)
    setFormError(null)
    const tracker = getActiveTracker()
    try {
      await submitLead({
        campaignId: props.campaignId,
        versionId: props.versionId,
        visitorId: tracker?.visitorId ?? 'anonymous',
        fields: v,
        utm: tracker?.utm ?? {},
        turnstileToken: token,
      })
      tracker?.track('form_submit', { form: 'lead' })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields)
        setFormError(err.message)
      } else setFormError('Could not send the form. Check your connection and try again.')
      if (props.turnstileSiteKey) setResetKey((k) => k + 1)
    }
    setPending(false)
  }

  if (done) {
    return (
      <Panel title="Thank you">
        <Success title="We have your details.">
          A Hoverline solutions engineer will write to {values.email} within one working day.
        </Success>
      </Panel>
    )
  }

  return (
    <Panel title="Your details">
      <form
        onSubmit={submit}
        onFocus={props.interactive ? onStart : undefined}
        noValidate
        className="space-y-4"
        data-form="lead"
      >
        {fields.map((f) => {
          const id = `${uid}-${f}`
          const common = {
            id,
            value: values[f] ?? '',
            disabled: !props.interactive,
            error: errors[f],
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setValues((x) => ({ ...x, [f]: e.target.value })),
          }
          if (f === 'name')
            return <Input key={f} {...common} label="Name" autoComplete="name" maxLength={80} />
          if (f === 'email')
            return (
              <Input
                key={f}
                {...common}
                label="Work email"
                type="email"
                autoComplete="email"
                maxLength={160}
              />
            )
          if (f === 'company')
            return (
              <Input
                key={f}
                {...common}
                label="Company"
                autoComplete="organization"
                maxLength={80}
              />
            )
          const spec = extraFields[f as keyof typeof extraFields]
          if (!spec) return null
          if (f === 'message') {
            return (
              <div key={f}>
                <label htmlFor={id} className="block text-sm font-semibold">
                  {spec.label} <span className="font-normal text-fg-muted">(optional)</span>
                </label>
                <textarea
                  id={id}
                  rows={3}
                  maxLength={spec.max}
                  value={values[f] ?? ''}
                  disabled={!props.interactive}
                  onChange={common.onChange}
                  className={field}
                />
              </div>
            )
          }
          return (
            <Input
              key={f}
              {...common}
              label={`${spec.label} (optional)`}
              type={spec.type}
              autoComplete={spec.autoComplete}
              maxLength={spec.max}
              min={spec.type === 'number' ? 1 : undefined}
            />
          )
        })}
        {props.interactive && props.turnstileSiteKey && (
          <Turnstile siteKey={props.turnstileSiteKey} onToken={setToken} resetKey={resetKey} />
        )}
        {formError && (
          <p role="alert" className="border-l-2 border-signal pl-2 text-sm">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || !props.interactive}
          className={`${primary} w-full`}
        >
          {pending ? 'Sending…' : props.cta.label}
        </button>
        <p className="text-xs text-fg-muted">We use these details only to reply to you.</p>
      </form>
    </Panel>
  )
}

/**
 * The closing section of every account page: what happens next on the left,
 * the calendar or the form on the right. Any click inside counts as a CTA
 * click (the tracking script delegates on [data-cta]).
 */
export function ClosingCta(props: ClosingCtaProps & { blockKey?: string; preview?: boolean }) {
  return (
    <section
      id="book"
      data-cta=""
      data-block-key={props.preview ? props.blockKey : undefined}
      aria-labelledby="book-heading"
      className="scroll-mt-6 bg-surface-raised"
    >
      <div className="mx-auto grid w-full max-w-[var(--container-page,86rem)] grid-cols-1 gap-x-12 gap-y-8 px-[var(--gutter,clamp(1rem,3vw,2.5rem))] py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] md:py-24">
        <div>
          <h2 id="book-heading" className="max-w-[18ch] text-2xl sm:text-3xl">
            {props.heading}
          </h2>
          {props.body && <p className="mt-4 max-w-[52ch] text-fg-muted">{props.body}</p>}
          {props.nextSteps && props.nextSteps.length > 0 && (
            <ol className="mt-6 space-y-3">
              {props.nextSteps.map((s, i) => (
                <li key={s} className="grid grid-cols-[1.75rem_1fr] items-baseline">
                  <span className="font-semibold text-accent tabular-nums">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {props.cta.kind === 'calendar' ? <SlotPicker {...props} /> : <LeadForm {...props} />}
      </div>
    </section>
  )
}
