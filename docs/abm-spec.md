# PageForge ABM — Account-Based Marketing Page Generator (PRD 2)

**One line:** an internal tool where a demand-gen marketer turns an account brief into an evidence-backed, branded Hoverline landing page for one target account, with every factual claim tied to a source, human review before publishing, and engagement flowing to analytics and CRM.

Hoverline (fictional drone-inspection company) is the seller. Target accounts are fictional. All metrics shown anywhere are labelled **illustrative**. No customer claim is ever invented.

---

## 1. Users and roles

| Role                        | Can                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketer**                | Create accounts and campaigns, gather sources, generate and edit drafts, choose CTA, submit for review, publish approved versions, pause, duplicate, roll back |
| **Sales rep**               | Add account context (pain points, notes) to a brief, view engagement timeline, copy tracked links                                                              |
| **Reviewer** (editor/legal) | Mark each claim supported / needs review / rejected, approve or send back a version                                                                            |
| **Prospect** (public)       | View the page, book a meeting, submit the demo form                                                                                                            |

Auth: a signed httpOnly cookie session. `ADMIN` login (env `FACTORY_ADMIN_PASSWORD`, renamed in UI to "Workspace password") unlocks the real workspace. A **public demo workspace** lets recruiters try everything in a sandbox: the visitor picks a role (Marketer / Sales / Reviewer) from a switcher; every action is written to the audit log with that role. Demo workspace data is isolated by `workspace = 'demo'` and reset nightly (cron-free: rows older than 7 days are hidden and purged lazily).

## 2. Primary flow

1. **Brief.** Marketer enters: company name, company URL, industry, site count, campaign type (`demo` | `campaign` | `solutions`), campaign goal (book meeting | download report | event invite), known pain points, target role, source channel. Optional sales notes.
2. **Public context.** System fetches public pages of the company URL (home + up to 3 same-site links that look like about/facilities/news), extracts **verbatim facts** with the source URL and quote. Shown to the marketer as a source list; each fact can be excluded.
3. **AI draft.** The model drafts the page using **only** (a) Hoverline's approved product facts (`@pageforge/content` facts, each with an id) and (b) included account facts, and **only** the approved block library (`@pageforge/blocks`). Output = page (blocks) + **claims list**: every factual statement in the copy, with the block key, field path, claim kind and source references.
4. **Edit.** Marketer edits copy per block field, picks CTA and form/calendar options. Editing a field marks claims inside it `needs_review` again.
5. **Review.** Reviewer goes claim by claim: `supported` (has a valid source; auto-suggested by the validator), `needs_review` (no or weak source), `rejected` (with note). Rejecting a claim removes it from the page: the containing sentence is deleted, or the block if it was the block's only claim; if a required field becomes empty, the version cannot be approved until edited.
6. **Publish settings.** System prepares: path, unguessable token for private pages, SEO title/description, canonical URL, OG image, UTM-tagged tracking links (per channel: email, LinkedIn, sales sequence), form config, calendar CTA, expiry date, noindex.
7. **Publish.** Only an **approved** version with **zero** `needs_review` claims can publish. Publishing snapshots the version; events start flowing to analytics and CRM.
8. **Operate.** Pause (page shows a neutral "This page is no longer available — contact your Hoverline rep" with 410), update (new draft version → review → publish), duplicate (for another account; account facts cleared), roll back (republish any earlier approved version in one click), expire (automatic at `expires_at`).

## 3. Page templates (routes)

| Template                | Route                   | Visibility                                                            |
| ----------------------- | ----------------------- | --------------------------------------------------------------------- |
| Account demo page       | `/demo/[slug]-[token]`  | private: unguessable 12-char token, noindex, not in sitemap           |
| Account campaign page   | `/campaign/[slug]`      | public link for campaigns, noindex by default (toggle)                |
| Industry solutions page | `/solutions/[industry]` | public, indexable; the **generic** baseline for conversion comparison |

All three render the published version's blocks through `BlockRenderer` from `@pageforge/ui/blocks`. No generated layout code, ever: the model can only choose blocks from the registry and fill their schema fields.

## 4. Claims model (the heart of the product)

```
Claim {
  id, versionId, blockKey, field (e.g. "subheading", "stats[1].value"),
  text            — the exact claim text as it appears in the copy
  kind            — 'product_fact' | 'account_fact' | 'positioning'
  sources         — [{ type: 'product_fact', factId } | { type: 'account_source', sourceFactId, url, quote }]
  status          — 'supported' | 'needs_review' | 'rejected'
  validator       — { ok: boolean, reasons: string[] }   // deterministic check result
  reviewedBy, reviewedAt, note
}
```

Deterministic validator (runs after every draft and edit):

- `product_fact` claims must reference an existing fact id, and every number in the claim text must appear in that fact.
- `account_fact` claims must reference an included source fact; key terms/numbers must appear in its verbatim quote.
- Any number, percentage, money amount, customer name or certification in the copy that is not covered by a claim with a valid source → an auto-created `needs_review` claim ("Unsourced statement").
- `positioning` claims (opinions, e.g. "built for ports that run around the clock") need no source but are labelled as positioning in review and cannot contain numbers.
- Banned phrases from `facts.voice.bannedPhrases` → validation error on the version.

Status rules: validator-ok claims start `supported` (still visible to reviewer), others `needs_review`. Publishing is blocked while any `needs_review` claim exists. Rejected claims never appear in a published version.

## 5. Public context extraction (security-critical)

- Only `http(s)` URLs; resolve DNS and **refuse private, loopback, link-local, CGNAT and metadata IP ranges** (IPv4 and IPv6), re-checked on every redirect (max 3). Port 80/443 only. Timeout 8 s, max 1.5 MB per page, `text/html` only.
- Respect `robots.txt` (`User-agent: PageForgeBot`); skip disallowed paths and tell the marketer.
- Extract readable text (strip nav/footer/scripts), split into sentences; the model selects candidate facts **by sentence index only**, so every stored quote is verbatim from the page.
- Store: source (url, title, fetched_at, robots_allowed, content hash) and source facts (quote, category: `operations` | `scale` | `initiatives` | `challenges` | `other`).
- Never fetch login-protected pages; never store page HTML, only extracted sentences used as facts.

Demo sources: fictional prospect sites are served by this app at `/fictional/[company]` (clearly labelled fictional, noindex) so the demo is reproducible. Seed: **Northstar Port Authority** (container port, 4 terminals, 2 cruise berths, perimeter security patrols) and **Halvorsen Solar Partners** (6 solar farms, 1.4 GW).

## 6. Analytics, CRM, calendar

- **Events** (first-party, always on, no cookies; anonymous visitor id in `localStorage`, first-party only): `page_view`, `scroll_depth` (25/50/75/100), `cta_click`, `form_start`, `form_submit`, `meeting_booked`. Sent via `navigator.sendBeacon` to `POST /api/abm/events` with `campaignId`, `versionId`, `visitorId`, UTM params, path. Rate-limited per visitor.
- **PostHog** (when `NEXT_PUBLIC_POSTHOG_KEY` set, after the visitor accepts the consent banner): the same events with the same properties, plus `$pageview`.
- **CRM:** every form submit creates a lead with account, campaign, UTM, page URL, and the visitor's engagement events so far. Built-in CRM (Supabase `pf_abm_leads`) always; **HubSpot** sync when `HUBSPOT_PRIVATE_APP_TOKEN` is set (contact + company + note with engagement summary; store `crm_id`). Meeting bookings update the lead.
- **Calendar CTA:** built-in slot picker (next 10 working days, 30-min slots 10:00–17:00 Asia/Kolkata and US Eastern shown in visitor's local time) that books into `pf_abm_meetings`. Labelled "demo calendar" in the sandbox.

## 7. Dashboards

- **Campaign view (sales):** engagement timeline per visitor and totals (views, max scroll, CTA clicks, form starts/submits, meetings), last active, "hot" flag (≥2 visits or ≥75% scroll or a CTA click in 7 days).
- **Overview:** account pages vs generic `/solutions` pages — visitors, form-submit rate, meeting rate, with sample sizes and an "illustrative data" label when seed data is shown. Never declare a winner below 100 visitors per side.
- **Review metrics:** claims per page, % sourced, % rejected, time from brief to review-ready (target < 15 min) and to publish.

## 8. Data model (Supabase, migration 0002, RLS on, server-only)

`pf_abm_accounts`, `pf_abm_campaigns`, `pf_abm_sources`, `pf_abm_source_facts`, `pf_abm_versions`, `pf_abm_claims`, `pf_abm_events`, `pf_abm_leads`, `pf_abm_meetings`, `pf_abm_audit`. See `supabase/migrations/0002_abm.sql`. TypeScript shapes: `apps/web/lib/abm/types.ts`.

Without Supabase the app uses an in-memory store with the same interface (demo only).

## 9. Non-functional

- Generation (sources + draft + validation) < 5 min; target < 90 s.
- Nothing is public until a human approves.
- Every factual statement keeps its source reference in the version snapshot.
- Private pages need the unguessable token; wrong token → 404 (no oracle).
- Lighthouse ≥ 90 on account pages (mobile), LCP < 2.5 s, no client JS beyond tracking, form and calendar.
- Secrets via `secretEnv()` and errors via `safeErrorMessage()` from `apps/web/lib/env.ts`.

## 10. Portfolio demo script (must work end to end, live and in simulation mode)

1. Open `/abm`, choose **Marketer**, start a brief for **Northstar Port Authority** (`/fictional/northstar-port-authority`), industry Ports, 4 sites, campaign type `demo`, goal book meeting, pain points "night-time perimeter patrols, crane inspections, berth security after hours", target role "Head of Security".
2. Sources load with verbatim quotes. Generate the draft.
3. The draft contains one **unsupported** claim (simulation mode always includes "cut security staffing costs by 40%"; live models are prompted not to, but the validator catches any). Switch to **Reviewer**, reject it with a note, approve the rest.
4. Approve the version, publish. Open the private URL.
5. As a prospect, scroll, click the CTA, book a meeting slot.
6. Back in `/abm`, the campaign timeline shows the visit, scroll depth, CTA click and meeting; the lead appears in the CRM view (and HubSpot when configured).
