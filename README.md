# PageForge

**Account-based marketing pages with evidence behind every claim.** A marketer turns an account brief into a branded landing page for one target account in minutes. AI drafts only from approved product facts and the account's own public pages, every factual statement carries its source, a reviewer signs off claim by claim, and engagement flows to analytics and the CRM.

PageForge runs the marketing site of **Hoverline**, a fictional drone-inspection company for refineries, substations, mines, ports and solar farms. Hoverline and every target account are fictional; all metrics in the demo are labelled illustrative.

**Live demo:** <https://pageforge-hazel.vercel.app/abm> (sandbox workspace, pick a role)

**Demo video (2 min):** [docs/demo-video.mp4](docs/demo-video.mp4) walks through the live demo. It is narrated with a text-to-speech voice.

## The 2-minute demo

1. Open `/abm`, choose **Marketer**, click **Use the Northstar example** and save the brief.
2. PageForge reads the account's public site and keeps 12 sentences **word for word**, each with its link.
3. **Generate draft.** The writer may use only Hoverline's approved facts and those sentences, and may only fill blocks from the design system. Every factual statement comes back as a claim with its source.
4. The draft contains one unsupported claim ("cut security staffing costs by 40%"). The deterministic validator flags it: _Number 40 does not appear in the cited source._
5. Switch to **Reviewer**, reject it with a note (the sentence leaves the page), approve the version.
6. Switch back to **Marketer** and publish. The private page gets an unguessable link, noindex, an expiry date and UTM-tagged links per channel.
7. Open the link as the prospect, scroll, click the CTA and book a slot.
8. As **Sales rep**, the campaign shows the visit, scroll depth, CTA clicks and the meeting; the lead is in the CRM view (and HubSpot when connected).

## How it works

```
Account brief
  → Public context   SSRF-safe fetcher, robots.txt respected, verbatim sentences only
  → AI draft         Gemini (Groq fallback) · registry blocks only · zod-validated · claims list
  → Validator        numbers must appear in the cited fact; unsourced numbers become claims
  → Review           supported / needs review / rejected · rejected text is removed
  → Publish          only an approved version with nothing left to review
  → Private page     /demo/[slug]-[token] · noindex · expiry · pause (410) · rollback
  → Engagement       first-party beacons → Supabase · PostHog after consent · HubSpot sync
  → Dashboards       per-account timeline, account vs generic page comparison, review metrics
```

**Why claims, not just copy:** in B2B marketing the risk is a confident sentence nobody can back up. Each claim stores the exact text, where it sits in the page, and the product fact or quoted source behind it. Publishing is blocked while any claim needs review, and the published version keeps its sources.

**Why one block registry:** every block is defined once (component, zod schema, Sanity schema, AI usage note). The site, the CMS and the drafting model read the same registry, so AI can only produce pages the design system can render.

## Repository

| Path               | What it holds                                                                        |
| ------------------ | ------------------------------------------------------------------------------------ |
| `apps/web`         | Next.js 16 site, ABM desk (`/abm`), account pages, API, Sanity Studio (`/studio`)    |
| `packages/ui`      | Hoverline design system: tokens, primitives, blocks, survey-chart illustrations      |
| `packages/blocks`  | Block registry shared by site, CMS and the drafting model                            |
| `packages/content` | Hoverline's approved facts (the only source of product claims) and seed pages        |
| `packages/agents`  | LLM clients, account-page drafting, claim validation and removal, offline simulation |
| `packages/qa`      | Lighthouse, axe and screenshot checks                                                |
| `docs/abm-spec.md` | Product spec: roles, flow, claims model, security, analytics, demo script            |
| `supabase`         | Migrations (`pf_` tables, RLS on, server-only access)                                |

## Stack (free tiers only)

Next.js 16 · React 19 · Tailwind CSS v4 · Sanity · Supabase · Google Gemini (Groq fallback) · PostHog · HubSpot free CRM · Cloudflare Turnstile · GitHub Actions · Vercel Hobby · Storybook

Without API keys the app runs in **simulation mode**: an offline writer produces a realistic draft (including the unsupported claim) and data lives in memory, so the whole demo works locally.

## Design

Hoverline's visual language is an **aeronautical survey chart**: chart paper and ink, a magenta flight route as the single accent, sage contour lines for quiet detail, and amber reserved for inspection findings. One typeface, Archivo, set expanded for headlines. Details in [`DESIGN.md`](DESIGN.md) and [`docs/design.md`](docs/design.md).

## Local development

Requires Node 22.12+ and pnpm 10.

```bash
pnpm install
cp .env.example apps/web/.env.local   # optional: every key is optional
pnpm dev                              # http://localhost:3000/abm
```

Checks run in CI on every push: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Author

Built by **Hussain Singapuri** ([@huss2003](https://github.com/huss2003)). MIT licensed.
