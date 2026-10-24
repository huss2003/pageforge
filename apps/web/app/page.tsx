import { SitePlan } from '@/components/site-plan'
import { site } from '@/lib/site'

const industries = [
  {
    name: 'Refineries and terminals',
    detail:
      'Tank shells, flare stacks and pipe racks, checked for corrosion and heat on every shift.',
  },
  {
    name: 'Power grids',
    detail:
      'Substations and transmission lines scanned for hot joints and vegetation encroachment.',
  },
  {
    name: 'Open-pit mines',
    detail: 'Pit walls and haul roads surveyed daily so slope movement is caught in millimetres.',
  },
]

export default function Home() {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center px-4 py-6 sm:px-6">
        <span className="text-lg font-bold [font-stretch:125%]">{site.name}</span>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-16">
          <div>
            <h1 className="text-4xl sm:text-5xl">
              Inspect the whole site without sending anyone up.
            </h1>
            <p className="mt-6 max-w-measure text-lg text-fg-muted">{site.description}</p>
            <a
              href="#industries"
              className="mt-10 inline-flex rounded-control bg-accent px-5 py-3 font-semibold text-accent-fg transition-colors hover:bg-accent-strong"
            >
              See where Hoverline flies
            </a>
          </div>
          <div className="rounded-media border border-line bg-surface-raised p-3 sm:p-5">
            <SitePlan />
          </div>
        </section>

        <section id="industries" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl">Where Hoverline flies</h2>
            <dl className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
              {industries.map((i) => (
                <div key={i.name} className="border-l-2 border-contour pl-5">
                  <dt className="font-semibold">{i.name}</dt>
                  <dd className="mt-2 text-fg-muted">{i.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-fg-muted sm:flex-row sm:justify-between sm:px-6">
          <p>{site.disclosure}</p>
          <a
            href="https://github.com/huss2003/pageforge"
            className="underline decoration-line underline-offset-4 hover:text-fg"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </>
  )
}
