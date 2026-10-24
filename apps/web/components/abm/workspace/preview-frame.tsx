'use client'

import type { Page } from '@pageforge/blocks'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CtaConfig } from '@/lib/abm/types'
import type { FromPreview, ToPreview } from '../preview-protocol'

const widths = { desktop: 1280, mobile: 390 } as const
type View = keyof typeof widths

/**
 * Live page preview: an iframe at a real viewport width (so breakpoints
 * behave as on the live page), scaled to fit the column. The desk posts the
 * page to it and asks it to highlight a block when a claim is hovered.
 */
export function PreviewFrame({
  page,
  cta,
  accountName,
  highlight,
  scrollToHighlight,
  onHoverBlock,
  title,
}: {
  page: Pick<Page, 'blocks'>
  cta: CtaConfig
  accountName: string | null
  highlight: string | null
  scrollToHighlight: boolean
  onHoverBlock?: (blockKey: string | null) => void
  title: string
}) {
  const [chosen, setView] = useState<View | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const onHoverRef = useRef(onHoverBlock)
  useEffect(() => {
    onHoverRef.current = onHoverBlock
  }, [onHoverBlock])

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setBox({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const send = useCallback((msg: ToPreview) => {
    frame.current?.contentWindow?.postMessage(msg, window.location.origin)
  }, [])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      const msg = e.data as FromPreview
      if (msg?.type === 'pf-preview:ready') setReady(true)
      if (msg?.type === 'pf-preview:hover') onHoverRef.current?.(msg.blockKey)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (ready) send({ type: 'pf-preview:render', page, cta, accountName })
  }, [ready, page, cta, accountName, send])

  useEffect(() => {
    if (ready)
      send({ type: 'pf-preview:highlight', blockKey: highlight, scroll: scrollToHighlight })
  }, [ready, highlight, scrollToHighlight, send, page])

  // Until someone picks, a narrow column shows the phone view.
  const view: View = chosen ?? (box.w && box.w < 700 ? 'mobile' : 'desktop')
  const inner = widths[view]
  const scale = box.w ? Math.min(1, box.w / inner) : 1
  const frameHeight = box.h ? box.h / scale : 800

  return (
    <section aria-labelledby="preview-heading" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="preview-heading" className="text-sm font-semibold [font-stretch:100%]">
          Preview
        </h2>
        <div
          role="group"
          aria-label="Preview width"
          className="flex rounded-control border border-line p-0.5 text-xs"
        >
          {(Object.keys(widths) as View[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={view === k}
              onClick={() => {
                setView(k)
                setReady(false)
              }}
              className="rounded-[2px] px-2.5 py-1 text-fg-muted aria-pressed:bg-fg aria-pressed:text-surface"
            >
              {k === 'desktop' ? 'Desktop' : 'Mobile'}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={wrap}
        className="relative mt-2 min-h-[28rem] flex-1 overflow-hidden rounded-media border border-line bg-[color-mix(in_oklab,var(--line)_35%,var(--surface))]"
      >
        <div
          className="absolute top-0 left-1/2 origin-top"
          style={{
            width: inner,
            height: frameHeight,
            transform: `translateX(-50%) scale(${scale})`,
          }}
        >
          <iframe
            key={view}
            ref={frame}
            src="/abm/preview"
            title={title}
            className="block size-full bg-surface"
          />
        </div>
        {!ready && (
          <p
            className="absolute inset-x-0 top-6 text-center text-sm text-fg-muted"
            aria-live="polite"
          >
            Loading preview…
          </p>
        )}
      </div>
      <p className="mt-1.5 text-xs text-fg-muted tabular-nums">
        {view === 'desktop'
          ? `1280 px wide, shown at ${Math.round(scale * 100)}%.`
          : '390 px wide.'}{' '}
        Hover a claim to find it on the page.
      </p>
    </section>
  )
}
