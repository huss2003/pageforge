'use client'

import { useEffect, useState } from 'react'
import { AccountBar } from './account-bar'
import { AccountPageBody } from './account-page'
import { isToPreview, type FromPreview, type ToPreview } from './preview-protocol'

type RenderMsg = Extract<ToPreview, { type: 'pf-preview:render' }>

function post(msg: FromPreview) {
  window.parent?.postMessage(msg, window.location.origin)
}

/** Inside the preview iframe: renders what the desk sends, highlights blocks on request. */
export function PreviewCanvas() {
  const [data, setData] = useState<RenderMsg | null>(null)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || !isToPreview(e.data)) return
      const msg = e.data
      if (msg.type === 'pf-preview:render') setData(msg)
      if (msg.type === 'pf-preview:highlight') {
        document
          .querySelectorAll('[data-pf-highlight]')
          .forEach((el) => el.removeAttribute('data-pf-highlight'))
        if (!msg.blockKey) return
        const el = document.querySelector(`[data-block-key="${CSS.escape(msg.blockKey)}"]`)
        if (!el) return
        el.setAttribute('data-pf-highlight', '')
        if (msg.scroll) {
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
        }
      }
    }
    function onOver(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest?.('[data-block-key]')
      post({ type: 'pf-preview:hover', blockKey: el?.getAttribute('data-block-key') ?? null })
    }
    // Links in a preview never navigate away.
    function onClick(e: MouseEvent) {
      if ((e.target as Element | null)?.closest?.('a')) e.preventDefault()
    }
    window.addEventListener('message', onMessage)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('click', onClick)
    post({ type: 'pf-preview:ready' })
    return () => {
      window.removeEventListener('message', onMessage)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <>
      <style>{`
        [data-block-key] { transition: box-shadow 120ms ease-out; }
        [data-pf-highlight] { box-shadow: inset 0 0 0 3px var(--accent); position: relative; z-index: 1; }
        html { scrollbar-width: thin; }
      `}</style>
      {data?.accountName && <AccountBar accountName={data.accountName} />}
      {data ? (
        <AccountPageBody
          page={data.page}
          cta={data.cta}
          campaignId={null}
          versionId={null}
          accountName={data.accountName}
          preview
        />
      ) : (
        <p className="p-6 text-sm text-fg-muted">Loading preview…</p>
      )}
    </>
  )
}
