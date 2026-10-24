'use client'

import { useEffect, useState } from 'react'
import { fixturesEnabled, request } from '@/lib/abm/client'
import {
  createTracker,
  readConsent,
  scrollPercent,
  setActiveTracker,
  writeConsent,
  type Consent,
  type Tracker,
  type TrackingContext,
} from '@/lib/abm/tracking'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || ''
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

/** Load PostHog only after consent, and mirror first-party events into it. */
async function startPostHog(tracker: Tracker): Promise<void> {
  if (!POSTHOG_KEY) return
  const { default: posthog } = await import('posthog-js')
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    autocapture: false,
    persistence: 'localStorage',
    disable_session_recording: true,
  })
  posthog.identify(tracker.visitorId)
  const ctx = tracker.context
  posthog.capture('$pageview', {
    campaignId: ctx.campaignId,
    versionId: ctx.versionId,
    pageKind: ctx.pageKind,
    path: ctx.path,
    ...Object.fromEntries(Object.entries(tracker.utm).map(([k, v]) => [`utm_${k}`, v])),
  })
  tracker.setMirror((type, props) => posthog.capture(type, props))
}

/**
 * First-party engagement tracking for an account page: page view, scroll
 * milestones and CTA clicks. Forms report their own start and submit.
 */
export function TrackingScript(props: TrackingContext) {
  const [consent, setConsent] = useState<Consent | null | 'unknown'>('unknown')
  const [tracker, setTracker] = useState<Tracker | null>(null)
  const { campaignId, versionId, pageKind, path } = props

  useEffect(() => {
    const t = createTracker(
      { campaignId, versionId, pageKind, path },
      fixturesEnabled()
        ? {
            send: (url, body) => void request('POST', url, JSON.parse(body)).catch(() => undefined),
          }
        : {},
    )
    setActiveTracker(t)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTracker(t)
    setConsent(readConsent())
    t.track('page_view', { referrer: document.referrer ? new URL(document.referrer).host : '' })

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const doc = document.documentElement
        t.scroll(scrollPercent(window.scrollY, window.innerHeight, doc.scrollHeight))
      })
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      const el = target?.closest?.('a, button')
      if (!el) return
      const inCta = el.closest('[data-cta]')
      const href = el.getAttribute('href') ?? ''
      const toCta =
        href.startsWith('#') &&
        Boolean(document.getElementById(href.slice(1))?.hasAttribute('data-cta'))
      if (!inCta && !toCta && !el.hasAttribute('data-cta')) return
      // Slot buttons report themselves with the slot they picked.
      if (inCta && el.closest('[role="group"]')) return
      t.track('cta_click', {
        label: (el.textContent ?? '').trim().slice(0, 60),
        from: inCta ? 'cta' : 'link',
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('click', onClick, { capture: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('click', onClick, { capture: true })
      if (frame) cancelAnimationFrame(frame)
      setActiveTracker(null)
    }
  }, [campaignId, versionId, pageKind, path])

  useEffect(() => {
    if (tracker && consent === 'accepted') void startPostHog(tracker).catch(() => undefined)
  }, [tracker, consent])

  if (!POSTHOG_KEY || consent !== null) return null

  function choose(c: Consent) {
    writeConsent(c)
    setConsent(c)
  }

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-media border border-line bg-surface p-4 text-sm shadow-[0_6px_24px_rgb(0_0_0/0.10)] sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <p>
        May we use PostHog to see how this page is read? It stays off unless you accept. Visits are
        still counted anonymously without it.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose('accepted')}
          className="min-h-10 rounded-control bg-fg px-4 font-semibold text-surface"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => choose('declined')}
          className="min-h-10 rounded-control border border-line px-4 font-semibold"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
