'use client'

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

/**
 * Desk primitives. Near-black primary, outlined secondary, text actions.
 * Magenta stays off chrome: it marks live pages, the current step and focus.
 */

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'

const variants: Record<Variant, string> = {
  primary:
    'bg-fg text-surface border border-fg hover:bg-[color-mix(in_oklab,var(--fg)_86%,var(--surface))] disabled:bg-fg/40 disabled:border-transparent',
  secondary:
    'border border-[color-mix(in_oklab,var(--line)_60%,var(--fg))] bg-surface-raised text-fg hover:border-fg disabled:text-fg-muted disabled:hover:border-line',
  quiet: 'border border-transparent text-fg hover:bg-surface-raised disabled:text-fg-muted',
  danger:
    'border border-[color-mix(in_oklab,var(--line)_60%,var(--fg))] bg-surface-raised text-fg hover:border-fg disabled:text-fg-muted',
}

const sizes = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-10 px-3.5 text-sm',
} as const

export function buttonClass(variant: Variant = 'secondary', size: keyof typeof sizes = 'md') {
  return `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]}`
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    size?: keyof typeof sizes
    pending?: boolean
    pendingLabel?: string
  }
>(function Button(
  { variant = 'secondary', size = 'md', pending, pendingLabel, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={rest.disabled || pending}
      aria-busy={pending || undefined}
      className={`${buttonClass(variant, size)} ${className ?? ''}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
})

export const inputClass =
  'w-full rounded-control border border-[color-mix(in_oklab,var(--line)_70%,var(--fg))] bg-surface-raised px-2.5 py-2 text-sm text-fg placeholder:text-fg-muted/80 focus-visible:border-accent focus-visible:outline-1 focus-visible:outline-offset-0 aria-[invalid=true]:border-signal'

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="mt-1 border-l-2 border-signal pl-2 text-sm">
      {children}
    </p>
  )
}

/** A failure inside the block that failed, with an optional retry. */
export function ErrorNote({
  children,
  onRetry,
  className,
}: {
  children: ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-signal py-1 pl-3 text-sm ${className ?? ''}`}
    >
      <span>{children}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold underline underline-offset-4"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function CopyButton({
  value,
  label = 'Copy',
  className,
  size = 'sm',
}: {
  value: string
  label?: string
  className?: string
  size?: keyof typeof sizes
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      setState('failed')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1800)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`${buttonClass('secondary', size)} min-w-16 ${className ?? ''}`}
    >
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy' : label}
      </span>
    </button>
  )
}

/** Flat grey bar at the size of the value it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-[2px] bg-[color-mix(in_oklab,var(--line)_55%,transparent)] ${className ?? ''}`}
    />
  )
}

export function SectionTitle({
  id,
  children,
  aside,
}: {
  id?: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-sm font-semibold [font-stretch:100%]">
        {children}
      </h2>
      {aside}
    </div>
  )
}

/** Small pill beside a value: pale tint, dark text of the same hue. */
export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'warn' | 'accent' | 'ok'
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-[color-mix(in_oklab,var(--line)_45%,transparent)] text-fg',
    warn: 'bg-[color-mix(in_oklab,var(--color-signal)_22%,transparent)] text-fg',
    accent: 'bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-accent-strong',
    ok: 'bg-[color-mix(in_oklab,var(--color-contour)_22%,transparent)] text-fg',
  }
  return (
    <span
      className={`inline-flex h-5 items-center rounded-[2px] px-1.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

/** Dialog built on <dialog>: focus trap, Escape and backdrop come from the platform. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-media border border-line bg-surface p-0 text-fg shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop:bg-[rgb(20_35_58/0.35)]"
    >
      {open && (
        <div className="p-5">
          <h2 id="dialog-title" className="text-lg [font-stretch:100%]">
            {title}
          </h2>
          <div className="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  )
}
