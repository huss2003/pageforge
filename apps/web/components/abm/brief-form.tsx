'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ApiError, createCampaign } from '@/lib/abm/client'
import type { AccountBrief, CampaignGoal, CampaignType, Industry } from '@/lib/abm/types'
import { useDeskSession } from './desk-shell'
import { channelLabels, goalLabels, industryLabels, typeHelp, typeLabels } from './labels'
import { Button, FieldError, inputClass } from './ui'

type Errors = Partial<Record<keyof AccountBrief | 'form', string>>

/** The spec §10 demo brief. The URL is the fictional site this app serves. */
export function northstarBrief(origin: string): AccountBrief {
  return {
    companyName: 'Northstar Port Authority',
    companyUrl: `${origin}/fictional/northstar-port-authority`,
    industry: 'ports',
    siteCount: 4,
    campaignType: 'demo',
    goal: 'book-meeting',
    painPoints: ['night-time perimeter patrols', 'crane inspections', 'berth security after hours'],
    targetRole: 'Head of Security',
    sourceChannel: 'email',
    salesNotes: 'Met their security lead at TOC Europe. Budget cycle closes in March.',
    expiresInDays: 60,
  }
}

const empty: AccountBrief = {
  companyName: '',
  companyUrl: '',
  industry: 'ports',
  siteCount: undefined,
  campaignType: 'demo',
  goal: 'book-meeting',
  painPoints: [],
  targetRole: '',
  sourceChannel: 'email',
  salesNotes: '',
  expiresInDays: 60,
}

/** Client-side checks mirror the contract limits; the server checks again. */
export function validateBrief(b: AccountBrief): Errors {
  const e: Errors = {}
  if (!b.companyName.trim()) e.companyName = 'Enter the company name.'
  else if (b.companyName.length > 80) e.companyName = 'Keep the name under 80 characters.'
  if (!b.companyUrl.trim()) e.companyUrl = 'Enter the company website.'
  else if (!/^https?:\/\/\S+$/i.test(b.companyUrl.trim()))
    e.companyUrl = 'Use the full address, starting with https://'
  else if (b.companyUrl.length > 300) e.companyUrl = 'Keep the address under 300 characters.'
  if (!b.targetRole.trim()) e.targetRole = 'Who will read the page? Add one job title.'
  else if (b.targetRole.length > 60) e.targetRole = 'Keep the role under 60 characters.'
  if (
    b.siteCount !== undefined &&
    (!Number.isInteger(b.siteCount) || b.siteCount < 1 || b.siteCount > 10000)
  )
    e.siteCount = 'A whole number from 1 to 10,000.'
  if (b.painPoints.length > 6) e.painPoints = 'Up to six pain points.'
  if ((b.salesNotes ?? '').length > 600) e.salesNotes = 'Keep notes under 600 characters.'
  if (
    b.campaignType !== 'solutions' &&
    b.expiresInDays !== undefined &&
    (b.expiresInDays < 1 || b.expiresInDays > 365)
  )
    e.expiresInDays = 'Between 1 and 365 days.'
  return e
}

function Field({
  id,
  label,
  help,
  error,
  children,
  className,
}: {
  id: string
  label: string
  help?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {help && <p className="text-xs text-fg-muted">{help}</p>}
      <div className="mt-1.5">{children}</div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  )
}

export function BriefForm() {
  const router = useRouter()
  const { can } = useDeskSession()
  const uid = useId()
  const id = (k: string) => `${uid}-${k}`
  const [brief, setBrief] = useState<AccountBrief>(empty)
  const [pain, setPain] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const painInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof AccountBrief>(k: K, v: AccountBrief[K]) => {
    setBrief((b) => ({ ...b, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  function addPain(raw: string) {
    const p = raw.trim().replace(/\s+/g, ' ')
    if (!p) return
    if (p.length > 120)
      return setErrors((e) => ({ ...e, painPoints: 'Keep each one under 120 characters.' }))
    if (brief.painPoints.length >= 6)
      return setErrors((e) => ({ ...e, painPoints: 'Up to six pain points.' }))
    if (!brief.painPoints.some((x) => x.toLowerCase() === p.toLowerCase()))
      set('painPoints', [...brief.painPoints, p])
    setPain('')
  }

  function onPainKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPain(pain)
    } else if (e.key === 'Backspace' && !pain && brief.painPoints.length) {
      set('painPoints', brief.painPoints.slice(0, -1))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const final: AccountBrief = {
      ...brief,
      painPoints: pain.trim() ? [...brief.painPoints, pain.trim()] : brief.painPoints,
      companyName: brief.companyName.trim(),
      companyUrl: brief.companyUrl.trim(),
      targetRole: brief.targetRole.trim(),
      salesNotes: brief.salesNotes?.trim() || undefined,
      expiresInDays: brief.campaignType === 'solutions' ? undefined : brief.expiresInDays,
    }
    const errs = validateBrief(final)
    if (Object.keys(errs).length) {
      setErrors(errs)
      const first = Object.keys(errs)[0]
      document.getElementById(id(first!))?.focus()
      return
    }
    setPending(true)
    try {
      const { campaignId } = await createCampaign(final)
      router.push(`/abm/campaigns/${campaignId}?step=sources&gather=1`)
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...(err.fields as Errors), form: err.message })
      else setErrors({ form: 'Could not save the brief. Try again.' })
      setPending(false)
    }
  }

  if (!can('marketer', 'sales')) {
    return (
      <main className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6">
        <h1 className="text-xl">New account page</h1>
        <p className="mt-2 text-fg-muted">
          Reviewers check claims; briefs come from marketing and sales. Switch to Marketer in the
          header to write one.
        </p>
      </main>
    )
  }

  const err = (k: keyof AccountBrief) => errors[k]
  const described = (k: keyof AccountBrief) => (errors[k] ? `${id(k)}-error` : undefined)

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8">
      <p className="text-sm">
        <Link
          href="/abm"
          className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Account pages
        </Link>
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl">New account page</h1>
        <button
          type="button"
          onClick={() => {
            setBrief(northstarBrief(window.location.origin))
            setErrors({})
            setPain('')
          }}
          className="text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-fg"
        >
          Use the Northstar example
        </button>
      </div>

      <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,44rem)_minmax(0,1fr)]">
        <form onSubmit={submit} noValidate className="space-y-7">
          <fieldset className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-fg-muted [font-stretch:100%]">
              Account
            </legend>
            <Field id={id('companyName')} label="Company" error={err('companyName')}>
              <input
                id={id('companyName')}
                value={brief.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                maxLength={80}
                autoComplete="off"
                placeholder="Northstar Port Authority"
                aria-invalid={Boolean(err('companyName'))}
                aria-describedby={described('companyName')}
                className={inputClass}
              />
            </Field>
            <Field id={id('companyUrl')} label="Website" error={err('companyUrl')}>
              <input
                id={id('companyUrl')}
                type="url"
                inputMode="url"
                value={brief.companyUrl}
                onChange={(e) => set('companyUrl', e.target.value)}
                maxLength={300}
                autoComplete="off"
                placeholder="https://"
                aria-invalid={Boolean(err('companyUrl'))}
                aria-describedby={described('companyUrl') ?? `${id('companyUrl')}-help`}
                className={inputClass}
              />
              <p id={`${id('companyUrl')}-help`} className="mt-1 text-xs text-fg-muted">
                We read the home page and up to three about, facilities or news pages.
              </p>
            </Field>
            <Field id={id('industry')} label="Industry">
              <select
                id={id('industry')}
                value={brief.industry}
                onChange={(e) => set('industry', e.target.value as Industry)}
                className={inputClass}
              >
                {(Object.keys(industryLabels) as Industry[]).map((k) => (
                  <option key={k} value={k}>
                    {industryLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id={id('siteCount')}
              label="Sites"
              help="Terminals, plants or farms they run."
              error={err('siteCount')}
            >
              <input
                id={id('siteCount')}
                type="number"
                min={1}
                max={10000}
                inputMode="numeric"
                value={brief.siteCount ?? ''}
                onChange={(e) =>
                  set('siteCount', e.target.value === '' ? undefined : Number(e.target.value))
                }
                aria-invalid={Boolean(err('siteCount'))}
                aria-describedby={described('siteCount')}
                className={`${inputClass} tabular-nums sm:w-32`}
              />
            </Field>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-fg-muted [font-stretch:100%]">
              Page
            </legend>
            <div role="radiogroup" aria-label="Page type" className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(typeLabels) as CampaignType[]).map((t) => (
                <label
                  key={t}
                  className="cursor-pointer rounded-control border border-line bg-surface-raised p-3 text-sm has-[:checked]:border-fg has-[:checked]:shadow-[inset_0_0_0_1px_var(--fg)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                >
                  <input
                    type="radio"
                    name="campaignType"
                    value={t}
                    checked={brief.campaignType === t}
                    onChange={() => set('campaignType', t)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{typeLabels[t]}</span>
                  <span className="mt-0.5 block text-xs text-fg-muted">{typeHelp[t]}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-3">
              <Field id={id('goal')} label="Goal">
                <select
                  id={id('goal')}
                  value={brief.goal}
                  onChange={(e) => set('goal', e.target.value as CampaignGoal)}
                  className={inputClass}
                >
                  {(Object.keys(goalLabels) as CampaignGoal[]).map((k) => (
                    <option key={k} value={k}>
                      {goalLabels[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={id('sourceChannel')} label="Main channel">
                <select
                  id={id('sourceChannel')}
                  value={brief.sourceChannel}
                  onChange={(e) =>
                    set('sourceChannel', e.target.value as AccountBrief['sourceChannel'])
                  }
                  className={inputClass}
                >
                  {(Object.keys(channelLabels) as AccountBrief['sourceChannel'][]).map((k) => (
                    <option key={k} value={k}>
                      {channelLabels[k]}
                    </option>
                  ))}
                </select>
              </Field>
              {brief.campaignType !== 'solutions' && (
                <Field id={id('expiresInDays')} label="Expires after" error={err('expiresInDays')}>
                  <div className="flex items-center gap-2">
                    <input
                      id={id('expiresInDays')}
                      type="number"
                      min={1}
                      max={365}
                      value={brief.expiresInDays ?? ''}
                      onChange={(e) =>
                        set(
                          'expiresInDays',
                          e.target.value === '' ? undefined : Number(e.target.value),
                        )
                      }
                      aria-invalid={Boolean(err('expiresInDays'))}
                      aria-describedby={described('expiresInDays')}
                      className={`${inputClass} w-24 tabular-nums`}
                    />
                    <span className="text-sm text-fg-muted">days</span>
                  </div>
                </Field>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="mb-3 text-sm font-semibold text-fg-muted [font-stretch:100%]">
              Reader
            </legend>
            <Field id={id('targetRole')} label="Who reads it" error={err('targetRole')}>
              <input
                id={id('targetRole')}
                value={brief.targetRole}
                onChange={(e) => set('targetRole', e.target.value)}
                maxLength={60}
                placeholder="Head of Security"
                aria-invalid={Boolean(err('targetRole'))}
                aria-describedby={described('targetRole')}
                className={`${inputClass} sm:max-w-sm`}
              />
            </Field>
            <Field
              id={id('painPoints')}
              label="Pain points"
              help="In the account's words. Up to six; press Enter after each."
              error={err('painPoints')}
            >
              <div
                className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-control border border-[color-mix(in_oklab,var(--line)_70%,var(--fg))] bg-surface-raised px-1.5 py-1 focus-within:border-accent"
                onClick={() => painInput.current?.focus()}
              >
                <ul className="contents" aria-label="Pain points added">
                  {brief.painPoints.map((p) => (
                    <li
                      key={p}
                      className="flex items-center gap-1 rounded-control border border-line bg-surface py-0.5 pr-0.5 pl-2 text-sm"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            'painPoints',
                            brief.painPoints.filter((x) => x !== p),
                          )
                        }
                        className="grid size-6 place-items-center rounded-[2px] text-fg-muted hover:bg-surface-raised hover:text-fg"
                        aria-label={`Remove ${p}`}
                      >
                        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <input
                  ref={painInput}
                  id={id('painPoints')}
                  value={pain}
                  onChange={(e) => setPain(e.target.value)}
                  onKeyDown={onPainKey}
                  onBlur={() => pain.trim() && addPain(pain)}
                  maxLength={120}
                  disabled={brief.painPoints.length >= 6}
                  placeholder={brief.painPoints.length ? '' : 'night-time perimeter patrols'}
                  aria-describedby={described('painPoints')}
                  className="min-w-40 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-fg-muted/80 disabled:hidden"
                />
              </div>
            </Field>
            <Field
              id={id('salesNotes')}
              label="Sales notes"
              help="Optional context for the writer. Never shown on the page."
              error={err('salesNotes')}
            >
              <textarea
                id={id('salesNotes')}
                value={brief.salesNotes ?? ''}
                onChange={(e) => set('salesNotes', e.target.value)}
                maxLength={600}
                rows={3}
                aria-invalid={Boolean(err('salesNotes'))}
                aria-describedby={described('salesNotes')}
                className={inputClass}
              />
              <p className="mt-1 text-right text-xs text-fg-muted tabular-nums">
                {(brief.salesNotes ?? '').length} / 600
              </p>
            </Field>
          </fieldset>

          {errors.form && <FieldError id="brief-form-error">{errors.form}</FieldError>}
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button type="submit" variant="primary" pending={pending} pendingLabel="Saving brief…">
              Save brief and read the website
            </Button>
            <Link
              href="/abm"
              className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
            >
              Cancel
            </Link>
          </div>
        </form>

        <aside aria-labelledby="next-heading" className="lg:pt-8">
          <h2 id="next-heading" className="text-sm font-semibold [font-stretch:100%]">
            After you save
          </h2>
          <ol className="mt-3 space-y-3 text-sm">
            {[
              [
                'Sources',
                'We fetch the public pages and keep sentences word for word, each with its link. You can leave any of them out.',
              ],
              [
                'Draft',
                'The writer uses only approved Hoverline facts and the sentences you kept, and lists every claim it makes.',
              ],
              [
                'Review',
                'A reviewer marks each claim supported or rejects it. A rejected claim leaves the page.',
              ],
              ['Publish', 'Only an approved version with nothing left to review can go live.'],
            ].map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[1.25rem_1fr] gap-x-2">
                <span className="text-fg-muted tabular-nums">{i + 2}</span>
                <span>
                  <span className="font-semibold">{t}.</span>{' '}
                  <span className="text-fg-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  )
}
