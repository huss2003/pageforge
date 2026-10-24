/**
 * Upserts every seed page from @pageforge/content into a Sanity dataset.
 *
 *   pnpm seed:sanity                     # dataset from NEXT_PUBLIC_SANITY_DATASET (default production)
 *   pnpm seed:sanity --dataset demo      # the Factory's public demo dataset
 *   pnpm seed:sanity --dry-run           # validate and print, write nothing
 *
 * Needs NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN (Editor).
 * Idempotent: documents use deterministic ids (`page-<slug>`) and are
 * replaced with createOrReplace in one transaction, so running it twice
 * leaves the dataset unchanged. Pages an editor created are not touched.
 */
import { createClient } from '@sanity/client'
import { seedPages } from '@pageforge/content'
import { apiVersion } from '../sanity/env'
import { toSanityDocument } from '../sanity/lib/documents'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1) return process.argv[i + 1]
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const dataset = arg('dataset') ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const token = process.env.SANITY_API_WRITE_TOKEN

  if (!['production', 'demo', process.env.SANITY_DEMO_DATASET].includes(dataset)) {
    console.warn(`Note: seeding a non-standard dataset "${dataset}".`)
  }

  const docs = seedPages.map(toSanityDocument)
  console.log(`Prepared ${docs.length} pages for dataset "${dataset}":`)
  for (const d of docs) console.log(`  ${d._id.padEnd(44)} ${d.kind}`)

  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }
  if (!projectId || !token) {
    console.error('Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN to seed Sanity.')
    process.exit(1)
  }

  const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })
  const tx = client.transaction()
  for (const doc of docs) tx.createOrReplace(doc)
  const result = await tx.commit({ visibility: 'sync' })
  console.log(`Upserted ${result.results.length} documents in ${projectId}/${dataset}.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
