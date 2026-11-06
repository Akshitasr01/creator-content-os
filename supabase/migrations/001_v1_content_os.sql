-- =====================================================================
-- Creator Content OS - Migration 001: complete the V1 data model
-- =====================================================================
-- SAFE TO RE-RUN. This migration is purely additive:
--   * it never drops tables, columns, rows or policies
--   * it only ADDs columns/tables/policies that do not exist yet
--   * it never disables Row Level Security
--
-- Already existing before this migration (left untouched):
--   creator_profiles, projects (incl. analysis, content_ideas), generated_content
--
-- How to run: Supabase Dashboard -> SQL Editor -> New query ->
-- paste this whole file -> Run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Extend existing tables
-- ---------------------------------------------------------------------

-- Platforms the creator publishes on (e.g. {instagram,linkedin}).
alter table public.creator_profiles
  add column if not exists target_platforms text[] not null default '{}';

-- Human-readable reason when analysis/generation fails, so the UI
-- never shows an endless spinner (status = 'failed').
alter table public.projects
  add column if not exists error_message text;

-- Per-asset review status, model metadata and version history.
alter table public.generated_content
  add column if not exists status text not null default 'draft',
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists version integer not null default 1,
  add column if not exists previous_versions jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'generated_content_status_check'
  ) then
    alter table public.generated_content
      add constraint generated_content_status_check
      check (status in ('draft', 'liked', 'disliked', 'approved'));
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------

-- Per-platform defaults (PDF step 5: platform_preferences).
create table if not exists public.platform_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'linkedin')),
  preferred_length text not null default 'medium'
    check (preferred_length in ('short', 'medium', 'long')),
  cta_style text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

-- Explicit quality signal on each generated asset (PDF step 25).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_id uuid not null references public.generated_content (id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  reason text check (
    reason is null or reason in
      ('too_formal', 'too_long', 'weak_hook', 'sounds_ai', 'not_my_voice', 'other')
  ),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_content_id_idx
  on public.feedback (content_id);

-- One row per AI call: used for per-user limits and cost tracking
-- (PDF step 26). Stores token counts only - never raw user content.
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  operation text not null,
  provider text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

create index if not exists generated_content_project_idx
  on public.generated_content (project_id);


-- ---------------------------------------------------------------------
-- 3. Privileges: the browser only talks to Supabase Auth; data access
--    goes through FastAPI using the signed-in user's token, so only the
--    'authenticated' role needs table access. Anonymous gets nothing.
-- ---------------------------------------------------------------------

revoke all on public.platform_preferences from anon;
revoke all on public.feedback from anon;
revoke all on public.usage_events from anon;

grant select, insert, update, delete on public.platform_preferences to authenticated;
grant select, insert on public.feedback to authenticated;
-- usage_events: insert + read only. No update/delete, so a user cannot
-- erase their own usage history to get around the free-tier limit.
grant select, insert on public.usage_events to authenticated;


-- ---------------------------------------------------------------------
-- 4. Row Level Security (owner-only access)
-- ---------------------------------------------------------------------

alter table public.creator_profiles enable row level security;
alter table public.projects enable row level security;
alter table public.generated_content enable row level security;
alter table public.platform_preferences enable row level security;
alter table public.feedback enable row level security;
alter table public.usage_events enable row level security;

-- Adds an owner-only policy for (table, command) ONLY if that table has
-- no policy covering the command yet. Existing policies are left alone.
create or replace function pg_temp.ensure_owner_policy(p_table text, p_cmd text)
returns void
language plpgsql
as $$
declare
  policy_name text := p_table || '_owner_' || lower(p_cmd);
begin
  if exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = p_table
      and (p.cmd = upper(p_cmd) or p.cmd = 'ALL')
  ) then
    return;
  end if;

  if upper(p_cmd) = 'INSERT' then
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (user_id = auth.uid())',
      policy_name, p_table);
  elsif upper(p_cmd) = 'UPDATE' then
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())',
      policy_name, p_table);
  else
    execute format(
      'create policy %I on public.%I for %s to authenticated
         using (user_id = auth.uid())',
      policy_name, p_table, lower(p_cmd));
  end if;
end;
$$;

select pg_temp.ensure_owner_policy('creator_profiles', 'SELECT');
select pg_temp.ensure_owner_policy('creator_profiles', 'INSERT');
select pg_temp.ensure_owner_policy('creator_profiles', 'UPDATE');

select pg_temp.ensure_owner_policy('projects', 'SELECT');
select pg_temp.ensure_owner_policy('projects', 'INSERT');
select pg_temp.ensure_owner_policy('projects', 'UPDATE');

select pg_temp.ensure_owner_policy('generated_content', 'SELECT');
select pg_temp.ensure_owner_policy('generated_content', 'INSERT');
select pg_temp.ensure_owner_policy('generated_content', 'UPDATE');

select pg_temp.ensure_owner_policy('platform_preferences', 'SELECT');
select pg_temp.ensure_owner_policy('platform_preferences', 'INSERT');
select pg_temp.ensure_owner_policy('platform_preferences', 'UPDATE');
select pg_temp.ensure_owner_policy('platform_preferences', 'DELETE');

select pg_temp.ensure_owner_policy('feedback', 'SELECT');
select pg_temp.ensure_owner_policy('feedback', 'INSERT');

select pg_temp.ensure_owner_policy('usage_events', 'SELECT');
select pg_temp.ensure_owner_policy('usage_events', 'INSERT');


-- ---------------------------------------------------------------------
-- 5. Verification query (read-only) - shows every policy afterwards
-- ---------------------------------------------------------------------
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
