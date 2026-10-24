import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../cn'

/**
 * Form fields: filled raised surface, 1px control border (4.5:1 against the
 * field), 3px radius, 48px tall. Labels sit above, always visible. Errors sit
 * under the field in the danger ink, linked with aria-describedby.
 */
const controlClass =
  'block w-full rounded-control border border-control bg-surface-raised px-3 text-base text-fg ' +
  'placeholder:text-fg-muted transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-fg focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 ' +
  'aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-60'

export interface FieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  className?: string
  children: (aria: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ id, label, hint, error, optional, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-fg">
        {label}
        {optional ? <span className="font-normal text-fg-muted"> (optional)</span> : null}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<'input'>) {
  return <input className={cn(controlClass, 'h-12', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea className={cn(controlClass, 'min-h-28 py-2.5', className)} {...props} />
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<'select'>) {
  return (
    <div className="relative">
      <select className={cn(controlClass, 'h-12 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 6 L8 10 L12 6" />
      </svg>
    </div>
  )
}
