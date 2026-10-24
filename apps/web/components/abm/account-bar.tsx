/** Slim line under the site header on one-account pages. No tracking language. */
export function AccountBar({ accountName }: { accountName: string }) {
  return (
    <div className="border-y border-line bg-surface-raised">
      <p className="mx-auto w-full max-w-[var(--container-page,86rem)] px-[var(--gutter,clamp(1rem,3vw,2.5rem))] py-2 text-sm">
        <span className="text-fg-muted">Prepared for</span>{' '}
        <span className="font-semibold">{accountName}</span>
      </p>
    </div>
  )
}
