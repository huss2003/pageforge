/**
 * In-page helpers. These run inside the browser (serialised with
 * `Function.prototype.toString`) and in unit tests against a static DOM, so
 * each exported function must be fully self-contained: no imports and no
 * references to anything outside its own body.
 */

/** A node to trace back to a block: axe `target` selectors or a Lighthouse node path. */
export interface TargetRequest {
  id: string
  /** axe `node.target`: one selector per frame; a nested array pierces shadow roots. */
  target?: (string | string[])[]
  /** Lighthouse `node.path`, e.g. "1,HTML,1,BODY,0,MAIN,2,SECTION". */
  path?: string
  /** Lighthouse `node.selector` (fallback; may be ambiguous). */
  selector?: string
}

/**
 * For each request, find the element and return the `data-block-key` of its
 * closest tagged ancestor (or itself). `null` when not inside a block.
 */
export function mapTargetsToBlockKeys(
  doc: Document,
  requests: TargetRequest[],
): Record<string, string | null> {
  function fromPath(path: string): Element | null {
    const parts = path.split(',')
    let node: Node | null = doc
    for (let i = 0; i + 1 < parts.length && node; i += 2) {
      const index = parts[i]!
      const name = parts[i + 1]!
      if (index === 'a' || index === 'u') {
        node = (node as Element).shadowRoot ?? null
        continue
      }
      // Same counting as Lighthouse: siblings in order, skipping whitespace-only text.
      const kids: Node[] = Array.from(node.childNodes).filter(
        (n) => !(n.nodeType === 3 && (n.nodeValue ?? '').trim() === ''),
      )
      const next: Node | undefined = kids[Number(index)]
      if (!next || next.nodeName.toUpperCase() !== name.toUpperCase()) return null
      node = next
    }
    return node && node.nodeType === 1 ? (node as Element) : null
  }

  function fromTarget(target: (string | string[])[]): Element | null {
    // Frames are not followed: draft previews do not use iframes for blocks.
    const last = target[target.length - 1]
    if (last === undefined) return null
    const chain = Array.isArray(last) ? last : [last]
    let root: Document | ShadowRoot = doc
    let el: Element | null = null
    for (let i = 0; i < chain.length; i++) {
      try {
        el = root.querySelector(chain[i]!)
      } catch {
        return null
      }
      if (!el) return null
      if (i < chain.length - 1) {
        if (!el.shadowRoot) return null
        root = el.shadowRoot
      }
    }
    return el
  }

  function keyOf(el: Element | null): string | null {
    let cur: Node | null = el
    while (cur) {
      if (cur.nodeType === 1) {
        const key = (cur as Element).getAttribute('data-block-key')
        if (key) return key
      }
      // Step out of shadow roots to the host.
      cur = cur.parentNode ?? ((cur as unknown as ShadowRoot).host as Node | undefined) ?? null
    }
    return null
  }

  const out: Record<string, string | null> = {}
  for (const r of requests) {
    let el: Element | null = null
    if (r.target) el = fromTarget(r.target)
    if (!el && r.path) el = fromPath(r.path)
    if (!el && r.selector) {
      try {
        el = doc.querySelector(r.selector)
      } catch {
        el = null
      }
    }
    out[r.id] = keyOf(el)
  }
  return out
}

export interface VisualFinding {
  id: 'horizontal-overflow' | 'heading-wrap' | 'block-too-tall'
  message: string
  blockKey: string
}

/**
 * Layout checks on the rendered mobile page, per tagged block:
 *  - horizontal-overflow: content wider than the viewport
 *  - heading-wrap: a heading that wraps to more than 3 lines
 *  - block-too-tall: a block taller than 2.5 screens
 * Advisory only: they feed the fixer but do not fail QA.
 */
export function visualChecks(doc: Document, win: Window): VisualFinding[] {
  const out: VisualFinding[] = []
  const vw = win.innerWidth
  const vh = win.innerHeight
  const blocks = Array.from(doc.querySelectorAll('[data-block-key]'))
  for (const block of blocks) {
    const key = block.getAttribute('data-block-key')!
    const kind = block.getAttribute('data-block') ?? 'block'
    const rect = block.getBoundingClientRect()

    let widest = 0
    for (const el of Array.from(block.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const style = win.getComputedStyle(el)
      if (style.position === 'fixed' || style.visibility === 'hidden') continue
      // Elements inside a horizontal scroller are allowed past the edge.
      let scroller = false
      for (let p = el.parentElement; p && p !== block.parentElement; p = p.parentElement) {
        const ox = win.getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
          scroller = true
          break
        }
      }
      if (!scroller) widest = Math.max(widest, r.right)
    }
    if (widest > vw + 1) {
      out.push({
        id: 'horizontal-overflow',
        message: `${kind} content is ${Math.round(widest - vw)}px wider than the ${vw}px viewport`,
        blockKey: key,
      })
    }

    for (const h of Array.from(block.querySelectorAll('h1, h2, h3'))) {
      const style = win.getComputedStyle(h)
      const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
      const lines = Math.round(h.getBoundingClientRect().height / lh)
      if (lines > 3) {
        out.push({
          id: 'heading-wrap',
          message: `${h.tagName.toLowerCase()} "${(h.textContent ?? '').trim().slice(0, 60)}" wraps to ${lines} lines at ${vw}px`,
          blockKey: key,
        })
        break
      }
    }

    if (rect.height > vh * 2.5) {
      out.push({
        id: 'block-too-tall',
        message: `${kind} is ${(rect.height / vh).toFixed(1)} screens tall on mobile`,
        blockKey: key,
      })
    }
  }
  return out
}

/**
 * Build a script string that defines the given self-contained functions and
 * evaluates `call`. The `__name` shim neutralises helpers that TS loaders
 * (tsx/esbuild keepNames) inject into function bodies.
 */
export function browserScript(fns: ((...args: never[]) => unknown)[], call: string): string {
  return `(() => {
  var __name = (f) => f;
  ${fns.map((f) => f.toString()).join('\n')}
  return ${call};
})()`
}
