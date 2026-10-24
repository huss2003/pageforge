'use client'

/**
 * Sanity Studio, embedded at /studio (app/studio/[[...tool]]/page.tsx).
 * Only loaded when NEXT_PUBLIC_SANITY_PROJECT_ID is set.
 */
import { visionTool } from '@sanity/vision'
import { defineConfig, type Template } from 'sanity'
import { presentationTool } from 'sanity/presentation'
import { structureTool } from 'sanity/structure'
import { apiVersion, dataset, projectId, studioBasePath } from './sanity/env'
import { resolve } from './sanity/presentation'
import { schemaTypes } from './sanity/schemaTypes'
import { structure } from './sanity/structure'

const pageOfKind: Template = {
  id: 'page-of-kind',
  title: 'Page of a given type',
  schemaType: 'page',
  parameters: [{ name: 'kind', type: 'string' }],
  value: (params: { kind?: string }) => ({
    kind: params.kind ?? 'page',
    seo: { noindex: params.kind === 'landing' },
  }),
}

export default defineConfig({
  name: 'hoverline',
  title: 'Hoverline',
  basePath: studioBasePath,
  projectId,
  dataset,
  schema: {
    types: schemaTypes,
    templates: (prev) => [...prev, pageOfKind],
  },
  plugins: [
    structureTool({ structure }),
    presentationTool({
      resolve,
      previewUrl: {
        previewMode: {
          enable: '/api/draft-mode/enable',
          disable: '/api/draft-mode/disable',
        },
      },
    }),
    // GROQ playground for developers; hidden in production builds.
    ...(process.env.NODE_ENV === 'development'
      ? [visionTool({ defaultApiVersion: apiVersion })]
      : []),
  ],
})
