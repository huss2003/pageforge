import { parseHTML } from 'linkedom'
import { splitSentences } from '@pageforge/agents'

/**
 * Readable text from an HTML page: drops scripts, styles, navigation,
 * headers, footers, forms and hidden elements, then splits the remaining
 * paragraphs and list items into sentences. Page HTML is never stored.
 */
export interface ExtractedPage {
  title: string | null
  sentences: string[]
  /** Same-site links that look like about/facilities/news pages (max 3). */
  links: string[]
}

const STRIP = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'nav',
  'header',
  'footer',
  'form',
  'aside',
  'button',
  'select',
  '[hidden]',
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
]
const BLOCKS = 'p, li, blockquote, td, dd, figcaption'
export const LINK_PATTERN =
  /about|company|facilit|operation|news|project|sustainab|security|who-we-are|our-port|terminals?/i
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)$/i

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

export function extractPage(html: string, pageUrl: string, maxLinks = 3): ExtractedPage {
  const { document } = parseHTML(html)
  const title = clean(document.querySelector('title')?.textContent) || null

  // Links first: navigation is where about/news links usually live.
  const base = new URL(pageUrl)
  const host = base.hostname.replace(/^www\./, '')
  const self = normalize(base)
  const links: string[] = []
  for (const a of document.querySelectorAll('a[href]')) {
    if (links.length >= maxLinks) break
    let u: URL
    try {
      u = new URL(a.getAttribute('href') ?? '', base)
    } catch {
      continue
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue
    if (u.hostname.replace(/^www\./, '') !== host) continue
    if (SKIP_EXT.test(u.pathname)) continue
    const key = normalize(u)
    if (key === self || links.some((l) => normalize(new URL(l)) === key)) continue
    if (!LINK_PATTERN.test(u.pathname) && !LINK_PATTERN.test(clean(a.textContent))) continue
    u.hash = ''
    links.push(u.href)
  }

  for (const sel of STRIP) for (const el of document.querySelectorAll(sel)) el.remove()
  const root = document.querySelector('main') ?? document.querySelector('article') ?? document.body
  const texts: string[] = []
  if (root) {
    for (const el of root.querySelectorAll(BLOCKS)) {
      // Collect the innermost block only (li > p would otherwise repeat).
      if (el.querySelector(BLOCKS)) continue
      const t = clean(el.textContent)
      if (t) texts.push(t)
    }
    if (!texts.length) texts.push(clean(root.textContent))
  }

  const seen = new Set<string>()
  const sentences: string[] = []
  for (const t of texts) {
    for (const s of splitSentences(t)) {
      // Whole sentences only: taglines, labels and headings have no final punctuation.
      if (s.length < 25 || s.length > 400 || !/[a-z]/i.test(s) || seen.has(s)) continue
      if (!/[.!?]["'”’)]?$/.test(s)) continue
      seen.add(s)
      sentences.push(s)
      if (sentences.length >= 150) break
    }
  }
  return { title, sentences, links }
}

function normalize(u: URL): string {
  return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '') || '/'}${u.search}`
}
