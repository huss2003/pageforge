import type { PagePlan } from '@/lib/factory/engine'
import { blockTitles } from '@/lib/factory/labels'

export function PlanList({ plan }: { plan: PagePlan | null }) {
  return (
    <section aria-labelledby="plan-heading">
      <h2 id="plan-heading" className="text-sm font-semibold [font-stretch:100%]">
        Page plan
      </h2>
      {plan ? (
        <>
          <p className="mt-1 text-sm text-fg-muted">{plan.angle}</p>
          <ol className="mt-3 space-y-2.5 text-sm">
            {plan.sections.map((s, i) => (
              <li key={`${s.kind}-${i}`} className="grid grid-cols-[1.5rem_1fr] gap-x-1">
                <span className="text-fg-muted tabular-nums">{i + 1}.</span>
                <span>
                  <span className="font-semibold">{blockTitles[s.kind] ?? s.kind}</span>
                  <span className="block text-fg-muted">{s.purpose}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="mt-2 border-y border-dashed border-line py-4 text-sm text-fg-muted">
          The planner is choosing sections from the Hoverline block library.
        </p>
      )}
    </section>
  )
}
