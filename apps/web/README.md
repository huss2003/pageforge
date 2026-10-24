# @pageforge/web

The Hoverline marketing site, the embedded Sanity Studio and (from M5) the PageForge Factory dashboard. Next.js 16 App Router, React 19, Tailwind CSS v4.

> Hoverline is a fictional company. Every operator, person and number on the site is invented for this portfolio project, and every page says so.

## Routes

| Route                  | Source                                         | Rendering                                   |
| ---------------------- | ---------------------------------------------- | ------------------------------------------- |
| `/`                    | page `home` (kind `home`)                      | Static                                      |
| `/[slug]`              | kinds `platform` and `page`                    | Static (`/platform`, `/book-a-demo`)        |
| `/industries`          | index built from every `industry` page         | Static                                      |
| `/industries/[slug]`   | kind `industry`                                | Static                                      |
| `/case-studies`        | index built from every `caseStudy` page        | Static                                      |
| `/case-studies/[slug]` | kind `caseStudy`                               | Static                                      |
| `/lp/[slug]`           | kind `landing` (Factory output)                | Static at build, new slugs render on demand |
| `/og/[...path]`        | Open Graph image for any page path             | Static PNG, 1200 × 630                      |
| `/sitemap.xml`         | every page without `seo.noindex`               | Static                                      |
| `/robots.txt`          | disallows `/factory /studio /api /preview /lp` | Static                                      |
| `/llms.txt`            | plain-text site summary for AI crawlers        | Static                                      |
| `/studio`              | Sanity Studio (setup notice without env)       | Static shell                                |
| `/api/revalidate`      | Sanity webhook → `revalidateTag`               | Dynamic                                     |
| `/api/draft-mode/*`    | enable and disable draft previews              | Dynamic                                     |

Each route accepts only its own page kinds, so `/industries/<case-study-slug>` is a 404 rather than a duplicate URL. `lib/paths.ts` is the single map from page kind to URL; the sitemap, breadcrumbs, OG images and the Studio's Presentation tool all use it.

## Content model

One document type, `page`, mirrors `pageSchema` in `packages/blocks`:

- `title`, `slug`, `kind` (`home`, `platform`, `industry`, `caseStudy`, `landing`, `page`)
- `seo` — title (≤ 60), description (≤ 160), `noindex` (campaign pages for one prospect)
- `blocks` — ordered array of the 14 block types (hero, operator strip, stats band, capabilities, use-case tabs, how it works, case study, testimonial, comparison, integrations, compliance, FAQ, call to action, demo form)
- `generatedBy` — read-only; set when the Factory's writer agent produced the page

Each block is its own Sanity object type in `sanity/schemaTypes/blocks.ts`, with the same field names, maximum lengths and array sizes as the zod schema. Block descriptions in the Studio come from the registry's `aiUsage` notes, so editors see the same "when to use this" guidance the planner agent reads. The page-level validator enforces the registry's placement rules (hero first, CTA or form last, per-page limits). `test/sanity-schema.test.ts` fails if the Studio schema drifts from zod.

All claims (numbers, operators, quotes, certifications) live in `packages/content/src/facts.ts`. Seed pages build their copy from those facts through typed selectors, and `packages/content` tests check that every stat, operator, case study and quote on a seed page exists in the facts and that no banned phrase appears.

## Content layer

`lib/content/index.ts`:

- `getPage(slug, { preview })`, `getPagesByKind(kind)`, `getAllPages()`, `getAllPublicPages()`
- Reads Sanity when `NEXT_PUBLIC_SANITY_PROJECT_ID` is set; otherwise serves the seed pages from `@pageforge/content`.
- Every CMS document is parsed with `pageSchema.safeParse`. Invalid or missing documents are logged and replaced by the seed page with the same slug, so a broken edit never renders a broken page. Listings merge CMS and seed pages by slug (CMS wins).
- Fetches are tagged `page:<slug>` and `pages` and cached for a day; the publish webhook expires them immediately.
- In draft mode, drafts are read with `SANITY_API_READ_TOKEN`. Copy keeps stega encoding for click-to-edit; enum fields such as `siteType` and `variant` are excluded so the renderer's switches still match.

## Editor workflow

1. Open `/studio` and sign in with your Sanity account.
2. Pick a page from **Home page**, **Industries**, **Case studies** or **Campaign landing pages** (Factory output is also listed under **Written by the Factory**).
3. Edit blocks. Character limits and block rules show inline before you can publish.
4. Use **Presentation** to see the draft on the real site with click-to-edit overlays (needs the read token).
5. **Publish.** Sanity calls `/api/revalidate`, which expires `page:<slug>` and `pages`. The page, its section index, the sitemap and `llms.txt` update within seconds, without a redeploy.

### Webhook setup

In sanity.io/manage → API → Webhooks, create one webhook per deployed dataset:

| Setting    | Value                                    |
| ---------- | ---------------------------------------- |
| URL        | `https://<site>/api/revalidate`          |
| Trigger on | Create, Update, Delete                   |
| Filter     | `_type == "page"`                        |
| Projection | `{_type, kind, "slug": slug.current}`    |
| Secret     | same value as `SANITY_REVALIDATE_SECRET` |

Also add the site URL and `http://localhost:3000` as CORS origins (with credentials) so the embedded Studio can sign in.

## Environment variables

All optional. With none set, `pnpm build` produces the full site from seed content and the demo form runs in demo mode.

| Variable                                                 | Used for                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                   | Canonical URLs, sitemap, OG and JSON-LD                                 |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`                          | Turns on Sanity as the content source and loads the Studio              |
| `NEXT_PUBLIC_SANITY_DATASET`                             | Dataset the site reads (default `production`)                           |
| `SANITY_DEMO_DATASET`                                    | Dataset for the public Factory demo (default `demo`)                    |
| `SANITY_API_READ_TOKEN`                                  | Draft mode and Presentation previews (Viewer)                           |
| `SANITY_API_WRITE_TOKEN`                                 | Seed script (Editor)                                                    |
| `SANITY_REVALIDATE_SECRET`                               | Verifies the publish webhook                                            |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`        | Stores demo requests in `pf_leads`, rate limits via `pf_hit_rate_limit` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile on the demo form                                   |

## Demo request form

`lib/actions/demo-request.ts` is the server action passed to `BlockRenderer` as `context.demoFormAction`. It expects fields `name`, `email`, `company`, `role`, `siteType` (`refinery | substation | open-pit | other`), `message` (≤ 1,000 characters) and, when Turnstile is on, `cf-turnstile-response`. It returns `DemoFormState` with per-field errors. With Supabase configured it allows five requests per IP hash per day and inserts into `pf_leads`; without it, it validates and answers in demo mode without storing anything.

## Seeding Sanity

```bash
# apps/web/.env.local needs NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN
pnpm seed:sanity                    # dataset from NEXT_PUBLIC_SANITY_DATASET
pnpm seed:sanity --dataset demo     # the Factory's demo dataset
pnpm seed:sanity --dry-run          # validate and list, write nothing
```

Documents get deterministic ids (`page-<slug>`; ids containing a dot are private in Sanity, so the public site could not read them). The script replaces them in one transaction, so it is safe to re-run. Pages created in the Studio are left alone. The **Seed Sanity** GitHub workflow runs the same script on demand; it needs the `SANITY_API_WRITE_TOKEN` secret and `NEXT_PUBLIC_SANITY_PROJECT_ID` as a repository variable or secret.

## SEO

- `generateMetadata` on every page: title template `%s | Hoverline`, description, canonical, robots (`noindex, nofollow` when `seo.noindex`), Open Graph and Twitter cards pointing at `/og/<path>`.
- JSON-LD (`components/json-ld.tsx`, typed with `schema-dts`): Organization and WebSite on the home page; WebPage and BreadcrumbList everywhere; FAQPage when a page has a FAQ block; Article for case studies; CollectionPage and ItemList on the indexes.
- OG images use Archivo Expanded, fetched as a glyph subset from Google Fonts at build time, with a fallback font if the network is unavailable.

## Scripts

```bash
pnpm dev          # next dev
pnpm build        # works with no env vars
pnpm test         # vitest: schema parity, JSON-LD, paths, form validation
pnpm typecheck
pnpm lint
```
