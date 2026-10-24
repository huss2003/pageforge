/** PageForge mark: a flight route with three waypoints, drawn in the route colour. */
export function RouteMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M3 19 L9 9 L15 14 L21 4"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="3" cy="19" r="2.2" fill="var(--accent)" />
      <circle
        cx="9"
        cy="9"
        r="2.2"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="1.6"
      />
      <circle
        cx="15"
        cy="14"
        r="2.2"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="1.6"
      />
      <circle cx="21" cy="4" r="2.2" fill="var(--accent)" />
    </svg>
  )
}
