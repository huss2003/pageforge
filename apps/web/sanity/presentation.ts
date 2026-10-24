import {
  defineDocuments,
  defineLocations,
  type PresentationPluginOptions,
} from 'sanity/presentation'
import type { PageKind } from '@pageforge/blocks'
import { pathFor } from '../lib/paths'

/**
 * Maps documents to the URLs where they render, so the Presentation tool
 * can open the right page and show "Used on" links in the document editor.
 */
export const resolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: defineDocuments([
    { route: '/', filter: `_type == "page" && kind == "home"` },
    {
      route: '/industries/:slug',
      filter: `_type == "page" && kind == "industry" && slug.current == $slug`,
    },
    {
      route: '/case-studies/:slug',
      filter: `_type == "page" && kind == "caseStudy" && slug.current == $slug`,
    },
    { route: '/lp/:slug', filter: `_type == "page" && kind == "landing" && slug.current == $slug` },
    { route: '/:slug', filter: `_type == "page" && slug.current == $slug` },
  ]),
  locations: {
    page: defineLocations({
      select: { title: 'title', slug: 'slug.current', kind: 'kind' },
      resolve: (doc) =>
        doc?.slug && doc.kind
          ? {
              locations: [
                { title: doc.title || 'Untitled', href: pathFor(doc.kind as PageKind, doc.slug) },
              ],
            }
          : null,
    }),
  },
}
