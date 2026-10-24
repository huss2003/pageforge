import type { RunStatus } from '@/lib/factory/engine'

/**
 * Small status glyph. Magenta only for "live" (the route reached its end);
 * amber only when something needs attention; everything else is ink or grey.
 */
export function StatusMark({ status, qaPassed }: { status: RunStatus; qaPassed?: boolean | null }) {
  const base = 'inline-block size-2 shrink-0 rounded-full align-middle'
  if (status === 'published') return <span aria-hidden="true" className={`${base} bg-accent`} />
  if (status === 'failed') return <span aria-hidden="true" className={`${base} bg-signal`} />
  if (status === 'ready')
    return (
      <span
        aria-hidden="true"
        className={`${base} ${qaPassed === false ? 'border-2 border-signal' : 'bg-fg'}`}
      />
    )
  return <span aria-hidden="true" className={`${base} border border-fg-muted`} />
}
