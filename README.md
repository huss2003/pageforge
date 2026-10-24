# PageForge

**An AI system that turns a sales brief into a tested, SEO-ready landing page — live in minutes, with quality gates built in.**

PageForge powers the marketing site of **Hoverline**, a fictional drone-inspection company for refineries, power grids and mines. Hoverline exists so the system has something real to market; it is not a real business.

> Status: **M0 — foundation.** Monorepo, design tokens and CI are in place. See the [roadmap](#roadmap).

## How it works

```
Brief form
  → Planner agent    picks sections from the design-system catalogue
  → Writer agent     writes copy only from brand facts stored in Sanity (no invented claims)
  → Zod validator    rejects malformed output and retries with the error (max 2)
  → Sanity draft     saved, not public
  → Preview URL      Next.js draft mode
  → QA run           GitHub Actions: Lighthouse + axe accessibility + screenshot diff
  → Fixer agent      patches failing content and re-runs QA (max 2 loops)
  → Human approval   → publish → on-demand revalidation → live in seconds
  → Metrics          timings, scores and token usage logged to Supabase
```

**Why QA runs in GitHub Actions:** Lighthouse needs a full Chrome, which Vercel's serverless functions cannot host. Actions is free for public repositories and gives every run a reproducible environment.

**Why one block registry:** every marketing block is defined once — component, content schema, Sanity schema and an AI usage note. The website, the CMS and the agents all read the same registry, so the AI can only produce pages the design system can render.

## Repository

| Path                | What it holds                                                                     |
| ------------------- | --------------------------------------------------------------------------------- |
| `apps/web`          | Next.js 16 site, Sanity Studio (`/studio`) and the Factory dashboard (`/factory`) |
| `packages/ui`       | Hoverline design system: tokens, primitives, blocks                               |
| `packages/blocks`   | Block registry shared by site, CMS and agents                                     |
| `packages/agents`   | Planner, writer and fixer agents                                                  |
| `packages/qa`       | Lighthouse, axe and screenshot checks                                             |
| `.github/workflows` | CI and the per-draft QA workflow                                                  |

## Stack (free tiers only)

Next.js 16 · React 19 · Tailwind CSS v4 · Sanity · Supabase · Google Gemini (Groq fallback) · GitHub Actions · Vercel Hobby · Cloudflare Turnstile · Storybook

## Design

Hoverline's visual language is an **aeronautical survey chart**: chart paper and ink, a magenta flight route as the single accent, sage contour lines for quiet detail, and amber reserved for inspection findings. One typeface, Archivo, set expanded for headlines and normal for text. Details in [`docs/design.md`](docs/design.md).

## Roadmap

| Milestone | Scope                                           | Status  |
| --------- | ----------------------------------------------- | ------- |
| M0        | Monorepo, tokens, CI                            | ✅ Done |
| M1        | Design system blocks, block registry, Storybook | Next    |
| M2        | Marketing site, Sanity content, SEO             |         |
| M3        | Planner → writer → validator → draft → preview  |         |
| M4        | QA in GitHub Actions + fixer loop               |         |
| M5        | Factory dashboard, metrics, public demo         |         |
| M6        | Write-up, architecture diagram, demo video      |         |

## Local development

Requires Node 22.12+ and pnpm 10.

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in what the current milestone needs
pnpm dev                              # http://localhost:3000
```

Checks run in CI on every push: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Content model, editor workflow and seeding are documented in [`apps/web/README.md`](apps/web/README.md).

## Author

Built by **Hussain Singapuri** ([@huss2003](https://github.com/huss2003)). MIT licensed.
