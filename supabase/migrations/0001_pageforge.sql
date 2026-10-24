-- PageForge schema. Every table is prefixed `pf_` so it can live safely
-- inside a shared Supabase project. Row level security is ON with no
-- policies: only the server (secret key) can read or write.

create extension if not exists pgcrypto;

-- One row per brief → page run.
create table if not exists public.pf_runs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 'demo' runs come from the public Factory and publish to a sandbox;
  -- 'production' runs are started by the admin and publish to Sanity.
  mode          text not null default 'demo' check (mode in ('demo', 'production')),
  status        text not null default 'queued' check (status in (
                  'queued','planning','writing','validating','drafted',
                  'qa-running','fixing','ready','published','failed')),
  brief         jsonb not null,
  plan          jsonb,
  page          jsonb,
  slug          text,
  draft_id      text,
  preview_url   text,
  qa_attempts   int not null default 0,
  last_qa       jsonb,
  error         text,
  model         text,
  simulated     boolean not null default false,
  ip_hash       text,
  started_at    timestamptz,
  ready_at      timestamptz,
  published_at  timestamptz,
  -- brief submitted → page live, in ms (the headline metric)
  time_to_ship_ms int
);
create index if not exists pf_runs_created_idx on public.pf_runs (created_at desc);
create index if not exists pf_runs_status_idx on public.pf_runs (status);
create unique index if not exists pf_runs_slug_mode_idx on public.pf_runs (mode, slug) where slug is not null and status = 'published';

-- Step-by-step log for the live timeline and debugging.
create table if not exists public.pf_run_steps (
  id          bigint generated always as identity primary key,
  run_id      uuid not null references public.pf_runs(id) on delete cascade,
  step        text not null check (step in ('plan','write','validate','draft','qa','fix','publish')),
  attempt     int not null default 1,
  model       text,
  started_at  timestamptz not null,
  duration_ms int not null,
  tokens_in   int,
  tokens_out  int,
  ok          boolean not null,
  summary     text not null,
  error       text
);
create index if not exists pf_run_steps_run_idx on public.pf_run_steps (run_id, id);

-- QA results posted back by the GitHub Actions workflow.
create table if not exists public.pf_qa_results (
  id          bigint generated always as identity primary key,
  run_id      uuid not null references public.pf_runs(id) on delete cascade,
  created_at  timestamptz not null default now(),
  attempt     int not null,
  url         text not null,
  scores      jsonb not null,
  issues      jsonb not null default '[]'::jsonb,
  passed      boolean not null,
  screenshot_url text,
  workflow_run_url text
);
create index if not exists pf_qa_results_run_idx on public.pf_qa_results (run_id, attempt);

-- Demo requests from the Hoverline site form.
create table if not exists public.pf_leads (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  company     text not null,
  role        text,
  site_type   text,
  message     text,
  source_path text
);

-- Fixed-window rate limiting (per IP hash and global), per UTC day.
create table if not exists public.pf_rate_limits (
  key    text not null,
  day    date not null default (now() at time zone 'utc')::date,
  count  int  not null default 0,
  primary key (key, day)
);

-- Atomically increments the counter and reports whether the call is allowed.
create or replace function public.pf_hit_rate_limit(p_key text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.pf_rate_limits as r (key, day, count)
  values (p_key, (now() at time zone 'utc')::date, 1)
  on conflict (key, day) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.pf_hit_rate_limit(text, int) from public, anon, authenticated;

create or replace function public.pf_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pf_runs_touch on public.pf_runs;
create trigger pf_runs_touch before update on public.pf_runs
  for each row execute function public.pf_touch_updated_at();

alter table public.pf_runs        enable row level security;
alter table public.pf_run_steps   enable row level security;
alter table public.pf_qa_results  enable row level security;
alter table public.pf_leads       enable row level security;
alter table public.pf_rate_limits enable row level security;
