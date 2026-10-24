'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render(
        el: HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'auto' | 'light' | 'dark'
          size?: 'normal' | 'flexible' | 'compact'
        },
      ): string
      reset(id?: string): void
      remove(id: string): void
    }
  }
}

/** Cloudflare Turnstile, rendered explicitly so React owns the element. */
export function Turnstile({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  /** Change to request a fresh token (tokens are single use). */
  resetKey: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  // Already loaded on client-side navigation back to the form.
  const [ready, setReady] = useState(
    () => typeof window !== 'undefined' && Boolean(window.turnstile),
  )
  const onTokenRef = useRef(onToken)
  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!ready || !ref.current || !window.turnstile || widget.current) return
    widget.current = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      theme: 'auto',
      size: 'flexible',
      callback: (t) => onTokenRef.current(t),
      'expired-callback': () => onTokenRef.current(null),
      'error-callback': () => onTokenRef.current(null),
    })
    return () => {
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
    }
  }, [ready, siteKey])

  useEffect(() => {
    if (resetKey > 0 && widget.current && window.turnstile) {
      window.turnstile.reset(widget.current)
      onTokenRef.current(null)
    }
  }, [resetKey])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={ref} className="min-h-[65px]" />
    </>
  )
}
