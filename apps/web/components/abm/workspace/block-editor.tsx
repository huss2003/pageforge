'use client'

import type { Block } from '@pageforge/blocks'
import { useMemo, useState, type FormEvent } from 'react'
import type { Claim } from '@/lib/abm/types'
import { editableFields } from '../block-fields'
import { Button, FieldError, inputClass } from '../ui'

/**
 * Side form for one block's copy. Fields come from the block schema; only
 * changed fields are sent. A field that carries claims warns that editing
 * sends those claims back to review.
 */
export function BlockEditor({
  block,
  label,
  claims,
  onSave,
  onClose,
  willFork,
  onFocusField,
}: {
  block: Block
  label: string
  claims: Claim[]
  onSave: (changes: { field: string; value: string }[]) => Promise<string | null>
  onClose: () => void
  /** The current version is approved: saving starts a new version. */
  willFork: boolean
  onFocusField?: () => void
}) {
  const fields = useMemo(() => editableFields(block), [block])
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.path, f.value])),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const changed = fields.filter((f) => (values[f.path] ?? '') !== f.value)
  const tooLong = fields.find((f) => f.max && (values[f.path] ?? '').length > f.max)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!changed.length || pending) return
    setPending(true)
    setError(null)
    const err = await onSave(changed.map((f) => ({ field: f.path, value: values[f.path] ?? '' })))
    setPending(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <form
      onSubmit={save}
      className="rounded-control border border-fg bg-surface-raised"
      aria-label={`Edit ${label}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2">
        <h3 className="text-sm font-semibold [font-stretch:100%]">Edit {label.toLowerCase()}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-fg-muted underline underline-offset-4 hover:text-fg"
        >
          Close
        </button>
      </div>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-3.5 py-3">
        {willFork && (
          <p className="border-l-2 border-signal pl-2 text-xs">
            This version is approved. Saving creates a new draft version; the approved one stays
            live until the new one is approved and published.
          </p>
        )}
        {fields.map((f) => {
          const id = `edit-${block._key}-${f.path}`
          const v = values[f.path] ?? ''
          const over = f.max !== undefined && v.length > f.max
          const fieldClaims = claims.filter((c) => c.field === f.path && c.status !== 'rejected')
          const common = {
            id,
            value: v,
            onFocus: onFocusField,
            'aria-invalid': over || undefined,
            'aria-describedby': `${id}-meta`,
            className: inputClass,
          }
          return (
            <div key={f.path}>
              <label htmlFor={id} className="block text-xs font-semibold">
                {f.label}
                {f.optional && <span className="font-normal text-fg-muted"> (optional)</span>}
              </label>
              <div className="mt-1">
                {f.kind === 'select' ? (
                  <select
                    {...common}
                    onChange={(e) => setValues((x) => ({ ...x, [f.path]: e.target.value }))}
                  >
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.kind === 'textarea' ? (
                  <textarea
                    {...common}
                    rows={3}
                    onChange={(e) => setValues((x) => ({ ...x, [f.path]: e.target.value }))}
                  />
                ) : (
                  <input
                    {...common}
                    onChange={(e) => setValues((x) => ({ ...x, [f.path]: e.target.value }))}
                  />
                )}
              </div>
              <p
                id={`${id}-meta`}
                className="mt-0.5 flex justify-between gap-3 text-xs text-fg-muted"
              >
                <span>
                  {fieldClaims.length > 0 &&
                    `${fieldClaims.length} ${fieldClaims.length === 1 ? 'claim' : 'claims'} here go back to review if you change it.`}
                </span>
                {f.max !== undefined && (
                  <span className={`tabular-nums ${over ? 'font-semibold text-fg' : ''}`}>
                    {v.length} / {f.max}
                  </span>
                )}
              </p>
            </div>
          )
        })}
        {fields.length === 0 && (
          <p className="text-sm text-fg-muted">This block has no editable copy.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2.5">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!changed.length || Boolean(tooLong)}
          pending={pending}
          pendingLabel="Saving…"
        >
          {changed.length
            ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}`
            : 'No changes'}
        </Button>
        <Button size="sm" variant="quiet" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <FieldError id={`edit-${block._key}-err`}>
          {error ?? (tooLong ? `${tooLong.label} is too long.` : null)}
        </FieldError>
      </div>
    </form>
  )
}
