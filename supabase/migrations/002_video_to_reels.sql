-- =====================================================================
-- Creator Content OS - Migration 002: AI Video-to-Reels Generator
-- =====================================================================
-- SAFE TO RE-RUN. Purely additive:
--   * creates two NEW tables (video_sources, video_clips) and one NEW
--     private storage bucket (video-clips)
--   * does NOT alter or drop any existing table, column, row or policy
--   * never disables Row Level Security
--
-- How to run: Supabase Dashboard -> SQL Editor -> New query ->
-- paste this whole file -> Run.  (Run 001 first if you have not.)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. video_sources: one long-form video/audio and its processing job
-- ---------------------------------------------------------------------
create table if not exists public.video_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  source_kind text not null check (source_kind in ('url', 'upload', 'audio')),
  media_type text not null default 'video' check (media_type in ('video', 'audio')),
  source_url text,
  original_filename text,
  requested_clips integer not null default 5 check (requested_clips between 1 and 10),
  status text not null default 'queued' check (
    status in ('queued', 'downloading', 'transcribing', 'selecting', 'rendering', 'completed', 'failed')
  ),
  progress integer not null default 0 check (progress between 0 and 100),
  status_message text,
  error_message text,
  duration_seconds numeric,
  language text,
  -- [{ "start": 1.2, "end": 4.8, "text": "...", "words": [[start, end, "word"], ...] }, ...]
  transcript jsonb,
  transcript_text text,
  provider text,
  model text,
  linked_project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_sources_user_created_idx
  on public.video_sources (user_id, created_at desc);


-- ---------------------------------------------------------------------
-- 2. video_clips: AI-selected moments (+ rendered file when available)
-- ---------------------------------------------------------------------
create table if not exists public.video_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_source_id uuid not null references public.video_sources (id) on delete cascade,
  clip_index integer not null,
  title text not null,
  start_seconds numeric not null,
  end_seconds numeric not null,
  duration_seconds numeric not null,
  hook text not null default '',
  transcript_excerpt text not null default '',
  caption text not null default '',
  hashtags text[] not null default '{}',
  cta text not null default '',
  reason text not null default '',
  -- not_rendered: suggestion only (or timestamps edited since last render)
  -- unavailable : no video to render from (audio source / no FFmpeg)
  render_status text not null default 'not_rendered' check (
    render_status in ('not_rendered', 'queued', 'rendering', 'rendered', 'failed', 'unavailable')
  ),
  render_error text,
  storage_path text,
  file_size_bytes bigint,
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_seconds > start_seconds)
);

create index if not exists video_clips_source_idx
  on public.video_clips (video_source_id, clip_index);


-- ---------------------------------------------------------------------
-- 3. Privileges (data goes through FastAPI with the user's token)
-- ---------------------------------------------------------------------
revoke all on public.video_sources from anon;
revoke all on public.video_clips from anon;
grant select, insert, update on public.video_sources to authenticated;
grant select, insert, update on public.video_clips to authenticated;


-- ---------------------------------------------------------------------
-- 4. Row Level Security: owner-only
-- ---------------------------------------------------------------------
alter table public.video_sources enable row level security;
alter table public.video_clips enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['video_sources', 'video_clips'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_owner_select') then
      execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_owner_select', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_owner_insert') then
      execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_owner_insert', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_owner_update') then
      execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner_update', t);
    end if;
  end loop;
end $$;

-- A clip may only belong to a video source owned by the same user.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'video_clips' and policyname = 'video_clips_source_owner_insert') then
    create policy video_clips_source_owner_insert on public.video_clips
      as restrictive for insert to authenticated
      with check (exists (
        select 1 from public.video_sources s
        where s.id = video_source_id and s.user_id = auth.uid()
      ));
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 5. Private storage bucket for rendered clips
--    Files live at  <user_id>/<video_source_id>/<clip_id>.mp4
--    50 MB per file (Supabase free-tier maximum). Only MP4 allowed.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('video-clips', 'video-clips', false, 52428800, array['video/mp4'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'video_clips_owner_select') then
    create policy video_clips_owner_select on storage.objects for select to authenticated
      using (bucket_id = 'video-clips' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'video_clips_owner_insert') then
    create policy video_clips_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'video-clips' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'video_clips_owner_update') then
    create policy video_clips_owner_update on storage.objects for update to authenticated
      using (bucket_id = 'video-clips' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'video-clips' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 6. Verification (read-only)
-- ---------------------------------------------------------------------
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('video_sources', 'video_clips')
   or (schemaname = 'storage' and policyname like 'video_clips_%')
order by schemaname, tablename, cmd;
