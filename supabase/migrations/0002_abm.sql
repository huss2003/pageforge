-- PageForge ABM (PRD 2): account-based marketing pages with sourced claims.
-- Same conventions as 0001: pf_ prefix, RLS on with no policies, server-only.

create table if not exists public.pf_abm_accounts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  workspace     text not null default 'demo' check (workspace in ('demo', 'main')),
  name          text not null,
  url           text not null,
  domain        text not null,
  industry      text not null,
  site_count    int,
  target_role   text,
  pain_points   text[] not null default '{}',
  sales_notes   text,
  created_by    text not null
);
create index if not exists pf_abm_accounts_ws_idx on public.pf_abm_accounts (workspace, created_at desc);

create table if not exists public.pf_abm_campaigns (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  workspace             text not null default 'demo' check (workspace in ('demo', 'main')),
  account_id            uuid references public.pf_abm_accounts(id) on delete cascade,
  type                  text not null check (type in ('demo', 'campaign', 'solutions')),
  industry              text not null,
  goal                  text not null check (goal in ('book-meeting', 'download-report', 'event-invite')),
  source_channel        text,
  status                text not null default 'draft' check (status in
                          ('draft', 'generating', 'in_review', 'approved', 'published', 'paused', 'expired', 'archived')),
  slug                  text not null,
  token                 text,                    -- unguessable, private demo pages only
  utm_campaign          text not null,
  expires_at            timestamptz,
  noindex               boolean not null default true,
  current_version_id    uuid,
  published_version_id  uuid,
  published_at          timestamptz,
  brief_at              timestamptz not null default now(),   -- for brief → review-ready time
  review_ready_at       timestamptz,
  created_by            text not null
);
create unique index if not exists pf_abm_campaigns_path_idx
  on public.pf_abm_campaigns (workspace, type, slug) where status <> 'archived';
create index if not exists pf_abm_campaigns_ws_idx on public.pf_abm_campaigns (workspace, updated_at desc);

create table if not exists public.pf_abm_sources (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.pf_abm_accounts(id) on delete cascade,
  url             text not null,
  title           text,
  fetched_at      timestamptz not null default now(),
  status          text not null check (status in ('ok', 'robots_disallowed', 'blocked', 'failed')),
  detail          text,
  content_hash    text
);
create index if not exists pf_abm_sources_account_idx on public.pf_abm_sources (account_id);

create table if not exists public.pf_abm_source_facts (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references public.pf_abm_sources(id) on delete cascade,
  account_id  uuid not null references public.pf_abm_accounts(id) on delete cascade,
  quote       text not null,                    -- verbatim sentence from the page
  category    text not null check (category in ('operations', 'scale', 'initiatives', 'challenges', 'other')),
  included    boolean not null default true
);
create index if not exists pf_abm_source_facts_account_idx on public.pf_abm_source_facts (account_id);

create table if not exists public.pf_abm_versions (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.pf_abm_campaigns(id) on delete cascade,
  number        int not null,
  created_at    timestamptz not null default now(),
  created_by    text not null,
  origin        text not null check (origin in ('ai_draft', 'edit', 'duplicate', 'rollback')),
  state         text not null default 'draft' check (state in ('draft', 'in_review', 'approved', 'changes_requested')),
  page          jsonb not null,                 -- Page (blocks) — rejected claims already removed
  seo           jsonb not null,
  cta           jsonb not null,                 -- { label, kind: 'calendar'|'form', formFields? }
  model         text,
  simulated     boolean not null default false,
  approved_by   text,
  approved_at   timestamptz,
  unique (campaign_id, number)
);

create table if not exists public.pf_abm_claims (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.pf_abm_versions(id) on delete cascade,
  block_key     text not null,
  field         text not null,
  text          text not null,
  kind          text not null check (kind in ('product_fact', 'account_fact', 'positioning')),
  sources       jsonb not null default '[]'::jsonb,
  status        text not null check (status in ('supported', 'needs_review', 'rejected')),
  validator     jsonb not null default '{"ok":false,"reasons":[]}'::jsonb,
  reviewed_by   text,
  reviewed_at   timestamptz,
  note          text
);
create index if not exists pf_abm_claims_version_idx on public.pf_abm_claims (version_id);

create table if not exists public.pf_abm_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  campaign_id   uuid references public.pf_abm_campaigns(id) on delete cascade,
  version_id    uuid,
  page_kind     text not null check (page_kind in ('account', 'generic')),
  path          text not null,
  visitor_id    text not null,
  type          text not null check (type in
                  ('page_view', 'scroll_depth', 'cta_click', 'form_start', 'form_submit', 'meeting_booked')),
  props         jsonb not null default '{}'::jsonb,
  utm           jsonb not null default '{}'::jsonb
);
create index if not exists pf_abm_events_campaign_idx on public.pf_abm_events (campaign_id, created_at desc);
create index if not exists pf_abm_events_kind_idx on public.pf_abm_events (page_kind, type, created_at desc);

create table if not exists public.pf_abm_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  campaign_id   uuid references public.pf_abm_campaigns(id) on delete set null,
  account_id    uuid references public.pf_abm_accounts(id) on delete set null,
  visitor_id    text,
  name          text not null,
  email         text not null,
  company       text not null,
  role          text,
  message       text,
  page_url      text not null,
  utm           jsonb not null default '{}'::jsonb,
  crm_provider  text not null default 'builtin' check (crm_provider in ('builtin', 'hubspot')),
  crm_id        text,
  crm_status    text not null default 'synced' check (crm_status in ('synced', 'pending', 'failed')),
  crm_error     text
);
create index if not exists pf_abm_leads_campaign_idx on public.pf_abm_leads (campaign_id, created_at desc);

create table if not exists public.pf_abm_meetings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  campaign_id   uuid references public.pf_abm_campaigns(id) on delete set null,
  lead_id       uuid references public.pf_abm_leads(id) on delete set null,
  slot_start    timestamptz not null,
  timezone      text not null
);
create unique index if not exists pf_abm_meetings_slot_idx on public.pf_abm_meetings (campaign_id, slot_start);

create table if not exists public.pf_abm_audit (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  workspace     text not null,
  campaign_id   uuid,
  actor_role    text not null check (actor_role in ('marketer', 'sales', 'reviewer', 'admin', 'system')),
  action        text not null,
  detail        jsonb not null default '{}'::jsonb
);
create index if not exists pf_abm_audit_campaign_idx on public.pf_abm_audit (campaign_id, created_at desc);

drop trigger if exists pf_abm_campaigns_touch on public.pf_abm_campaigns;
create trigger pf_abm_campaigns_touch before update on public.pf_abm_campaigns
  for each row execute function public.pf_touch_updated_at();

alter table public.pf_abm_accounts     enable row level security;
alter table public.pf_abm_campaigns    enable row level security;
alter table public.pf_abm_sources      enable row level security;
alter table public.pf_abm_source_facts enable row level security;
alter table public.pf_abm_versions     enable row level security;
alter table public.pf_abm_claims       enable row level security;
alter table public.pf_abm_events       enable row level security;
alter table public.pf_abm_leads        enable row level security;
alter table public.pf_abm_meetings     enable row level security;
alter table public.pf_abm_audit        enable row level security;
