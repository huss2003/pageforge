import { defineEnableDraftMode } from 'next-sanity/draft-mode'
import { client } from '@/sanity/lib/client'
import { secretEnv } from '@/lib/env'

/**
 * Called by the Studio's Presentation tool. It validates a short-lived
 * preview secret against the dataset (needs a Viewer token), then turns on
 * Next.js draft mode so pages read drafts with visual-editing overlays.
 */
const token = secretEnv('SANITY_API_READ_TOKEN') || secretEnv('SANITY_API_WRITE_TOKEN')

export const GET =
  client && token
    ? defineEnableDraftMode({ client: client.withConfig({ token }) }).GET
    : () =>
        Response.json(
          {
            error:
              'Draft previews need NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_READ_TOKEN to be set.',
          },
          { status: 501 },
        )
