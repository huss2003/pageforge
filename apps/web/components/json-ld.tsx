import type { Graph, Thing, WithContext } from 'schema-dts'

/**
 * Renders structured data. Types come from schema-dts, so a misspelt
 * property or wrong value type fails the typecheck instead of failing
 * silently in Google's Rich Results test.
 */
export function JsonLd({ data }: { data: Graph | WithContext<Thing> }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so copy can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
