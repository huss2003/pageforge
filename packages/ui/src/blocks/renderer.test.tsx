import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BlockRenderer, resolveFields } from './index'
import { allExamples, examplePage } from './examples'

describe('BlockRenderer', () => {
  it('renders every block as a tagged section on the server', () => {
    const html = renderToStaticMarkup(<BlockRenderer blocks={allExamples} />)
    for (const b of allExamples) {
      expect(html).toContain(`data-block="${b._type}"`)
      expect(html).toContain(`id="${b._key}"`)
    }
    expect(html).not.toContain('data-block-key')
  })

  it('adds data-block-key only in preview mode', () => {
    const html = renderToStaticMarkup(
      <BlockRenderer blocks={examplePage} context={{ preview: true }} />,
    )
    for (const b of examplePage) expect(html).toContain(`data-block-key="${b._key}"`)
  })

  it('renders one h1, from the hero', () => {
    const html = renderToStaticMarkup(<BlockRenderer blocks={examplePage} />)
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
  })

  it('server-renders the route planner with the default site checked', () => {
    const html = renderToStaticMarkup(<BlockRenderer blocks={examplePage} />)
    const radio = html.match(/<input[^>]*value="refinery"[^>]*>/)?.[0] ?? ''
    expect(radio).toContain('type="radio"')
    expect(radio).toContain('checked')
  })

  it('renders the demo form disabled when no action is wired', () => {
    const html = renderToStaticMarkup(<BlockRenderer blocks={examplePage} />)
    expect(html).toContain('This form is not connected here')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
  })

  it('never puts two tinted grounds back to back', () => {
    const fields = resolveFields(allExamples)
    fields.forEach((f, i) => {
      if (i > 0 && f !== 'paper') expect(fields[i - 1]).not.toBe(f)
    })
  })
})
