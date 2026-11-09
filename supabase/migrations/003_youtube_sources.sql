-- =====================================================================
-- Creator Content OS - Migration 003: YouTube video sources
-- =====================================================================
-- Requires migration 002. SAFE TO RE-RUN.
--   * ADDS columns to video_sources (YouTube id/url/metadata, transcript source)
--   * WIDENS two allowed-value lists:
--       source_kind  += 'youtube'
--       status       += 'awaiting_transcript'
--     (the old CHECK constraint is replaced by a broader one; no rows change)
--   * no data is deleted, no RLS policy changes (existing owner-only policies apply)
--
-- How to run: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

alter table public.video_sources
  add column if not exists youtube_video_id text,
  add column if not exists youtube_url text,
  add column if not exists thumbnail_url text,
  add column if not exists channel_title text,
  add column if not exists transcript_source text;

do $$
begin
  -- transcript_source: where the timestamped transcript came from
  if not exists (select 1 from pg_constraint where conname = 'video_sources_transcript_source_check') then
    alter table public.video_sources
      add constraint video_sources_transcript_source_check
      check (transcript_source is null or transcript_source in ('whisper', 'youtube_captions', 'manual'));
  end if;

  -- source_kind: add 'youtube'
  alter table public.video_sources drop constraint if exists video_sources_source_kind_check;
  alter table public.video_sources
    add constraint video_sources_source_kind_check
    check (source_kind in ('url', 'upload', 'audio', 'youtube'));

  -- status: add 'awaiting_transcript' (YouTube projects wait for captions / a pasted transcript)
  alter table public.video_sources drop constraint if exists video_sources_status_check;
  alter table public.video_sources
    add constraint video_sources_status_check
    check (status in ('awaiting_transcript', 'queued', 'downloading', 'transcribing', 'selecting',
                      'rendering', 'completed', 'failed'));

  -- YouTube ids are always 11 characters of [A-Za-z0-9_-]
  if not exists (select 1 from pg_constraint where conname = 'video_sources_youtube_id_check') then
    alter table public.video_sources
      add constraint video_sources_youtube_id_check
      check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$');
  end if;
end $$;

-- Verification (read-only)
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.video_sources'::regclass and contype = 'c'
order by conname;
