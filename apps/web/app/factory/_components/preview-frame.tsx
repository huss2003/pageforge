'use client'

import { useState } from 'react'
import type { PublicRun } from '@/lib/factory/types'

const widths = { desktop: '100%', mobile: '390px' } as const

export function PreviewFrame({ run }: { run: PublicRun }) {
  const [view, setView] = useState<keyof typeof widths>('desktop')
  // Version the iframe by page content so fixes reload it.
  const version = run.fixes.length
  // The stored URL is absolute for the QA runner; the iframe uses the same-origin path.
  const src = run.previewUrl
    ? (() => {
        const u = new URL(run.previewUrl, 'http://localhost')
        u.searchParams.set('v', String(version))
        return `${u.pathname}${u.search}`
      })()
    : null

  return (
    <section aria-labelledby="preview-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="preview-heading" className="text-sm font-semibold [font-stretch:100%]">
          Draft preview
        </h2>
        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Preview width"
            className="flex rounded-control border border-line p-0.5 text-xs"
          >
            {(Object.keys(widths) as (keyof typeof widths)[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={view === k}
                onClick={() => setView(k)}
                className="rounded-[2px] px-2.5 py-1 capitalize aria-pressed:bg-fg aria-pressed:text-surface"
              >
                {k === 'desktop' ? 'Desktop' : 'Mobile 390'}
              </button>
            ))}
          </div>
          {src && (
            <a
              href={src}
              target="_blank"
              rel="noopener"
              className="text-xs underline underline-offset-4"
            >
              Open in a new tab
            </a>
          )}
        </div>
      </div>
      <div className="mt-2 overflow-hidden rounded-media border border-line bg-surface-raised">
        {src ? (
          <div className="flex justify-center bg-[color-mix(in_oklab,var(--line)_35%,transparent)]">
            <iframe
              key={src}
              src={src}
              title={`Draft preview of ${run.page?.title ?? 'the generated page'}`}
              className="h-[min(72vh,46rem)] bg-surface transition-[width] duration-200"
              style={{ width: widths[view], maxWidth: '100%' }}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="grid h-[min(60vh,32rem)] place-items-center p-6 text-center text-sm text-fg-muted">
            {run.status === 'failed'
              ? 'No draft was saved before the run stopped.'
              : 'The draft appears here once the writer has saved it.'}
          </div>
        )}
      </div>
      {run.page && (
        <p className="mt-2 text-xs text-fg-muted">
          <span className="text-fg">{run.page.seo.title}</span> · {run.page.blocks.length} blocks ·
          noindex
        </p>
      )}
    </section>
  )
}
