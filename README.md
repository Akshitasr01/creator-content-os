# Creator Content OS

AI-powered content repurposing for educators, coaches and professional creators.

> **Turn one long-form piece of content into a week of platform-specific content written in the creator's voice.**

Paste a transcript, article, script or notes → the app builds a **Content Brief** → suggests **content ideas** →
writes **Instagram Reel scripts, LinkedIn posts and carousel copy** in your voice → you review, edit, rewrite,
rate and copy everything in the **Content Studio**.

---

## Features (V1)

| Area | What it does |
|---|---|
| Auth | Email/password sign up & sign in (Supabase Auth), email-confirmation aware, protected routes, session persistence |
| Creator profile | One onboarding form: niche, audience, language (English/Hindi/Hinglish), tone, style, things to avoid, target platforms, 3 sample posts. Editable in **Settings**, plus per-platform length & CTA preferences |
| Projects | Title + source type (transcript/article/notes/script) + pasted text, length-validated, **saved before any AI call** |
| Analysis | Structured Content Brief (topic, audience, summary, key themes, examples, strong claims, hooks, angles). User can **edit/correct** it |
| Ideas | 10 standalone angles labelled with the platforms they fit; select the ones you want or let the app pick |
| Generation | Reels (hook, 30-60s spoken script, caption, CTA, hashtags), LinkedIn posts (strong first line, readable body, CTA), carousels (slide-by-slide copy) |
| Creator voice | Profile + sample posts + brief + idea + platform rules in every generation prompt |
| Content Studio | Grouped by platform, slide preview, copy (whole asset or per section), edit with explicit save, approve, **version history with restore** |
| Rewrite | Shorter · Stronger hook · More conversational · More professional · Simplify · More storytelling · Convert to Hinglish · Regenerate - affects only that asset |
| Feedback | 👍 / 👎 with a quick reason (too formal, too long, weak hook, sounds AI, not my voice, other) + optional note |
| Safety & cost | Backend-only API keys, token verification on every request, RLS, per-minute rate limit, daily AI-call limit, token/cost logging per user/project |
| Demo mode | `AI_PROVIDER=mock` gives free, clearly labelled **Demo output** so you can test everything without an API key |

Out of scope for V1 (per the build guide): video/YouTube ingestion, scheduling, teams, analytics, payments, vector memory.

## Tech stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + React Router
- **Backend:** Python + FastAPI + Pydantic
- **Database & Auth:** Supabase (Postgres + Auth, Row Level Security)
- **AI:** OpenAI Responses API with structured outputs, behind one `llm_service` (or the free mock provider)

```
React (browser)  --Bearer token-->  FastAPI  --user's token-->  Supabase Postgres (RLS)
     |                                 |
     '-- Supabase Auth (login only)    '--> OpenAI API (or mock)
```

The browser uses Supabase **only for login**. All app data goes through FastAPI, which verifies the user's
token and queries Supabase **as that user**, so Row Level Security always applies. The service-role key is
never used.

## Folder structure

```
creator-content-os/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, error handlers
│   ├── api/                    # HTTP routes only (thin)
│   │   ├── deps.py             #   auth (token verification), repository, LLM per request
│   │   ├── health.py  creators.py  projects.py  generate.py  content.py  feedback.py
│   ├── services/               # business logic
│   │   ├── llm_service.py      #   the ONLY place that calls an AI provider
│   │   ├── mock_provider.py    #   free demo output
│   │   ├── content_analyzer.py  idea_generator.py
│   │   ├── reel_generator.py  linkedin_generator.py  carousel_generator.py  rewriter.py
│   │   ├── project_service.py  content_service.py  profile_service.py  usage_service.py
│   ├── prompts/                # all prompt text (voice, analyzer, ideas, reel, linkedin, carousel, rewrite)
│   ├── schemas/                # Pydantic request/response + structured AI output models
│   ├── db/                     # Supabase REST client + repository (user-scoped queries)
│   ├── core/                   # settings + error types
│   ├── tests/                  # pytest (in-memory DB + mock AI)
│   ├── golden/inputs/          # 5 benchmark sources for prompt-quality checks
│   └── scripts/run_golden.py
├── frontend/src/
│   ├── pages/                  # Landing, Auth, Onboarding, Dashboard, NewProject, Project (brief+ideas), ContentStudio, Settings
│   ├── components/             # ui.jsx primitives, AppShell, RouteGuards, ProfileForm, project/*, studio/*
│   ├── context/  hooks/        # auth, profile, toast state
│   ├── services/api.js         # every backend call
│   └── lib/                    # supabase client, constants
└── supabase/migrations/        # versioned SQL
```

## Setup

### 1. Prerequisites
Python 3.12+, Node 20+, a Supabase project, and (optionally) an OpenAI API key.

### 2. Database (Supabase)
1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste `supabase/migrations/001_v1_content_os.sql` → **Run**.
   It is additive and safe to re-run: it adds missing columns/tables (`feedback`, `platform_preferences`,
   `usage_events`) and owner-only RLS policies, and never drops anything.
3. **Authentication → Providers → Email** must be enabled. If "Confirm email" is on, new users must click the
   email link before signing in (the app handles this, including a "Resend link" button).
4. **Authentication → URL Configuration**: add `http://localhost:5173` to the Redirect URLs.

### 3. Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env          # then fill in the values
uvicorn main:app --reload
```
API: http://127.0.0.1:8000 · Interactive docs: **http://127.0.0.1:8000/docs**

### 4. Frontend
```powershell
cd frontend
npm install
copy .env.example .env.local    # then fill in the values
npm run dev
```
App: http://localhost:5173

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| backend/.env | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Verify users and query the DB as them |
| backend/.env | `AI_PROVIDER` | `mock` (free demo) or `openai` |
| backend/.env | `OPENAI_API_KEY`, `OPENAI_MODEL` | Required when `AI_PROVIDER=openai` |
| backend/.env | `DAILY_AI_CALL_LIMIT`, `AI_REQUESTS_PER_MINUTE`, `SOURCE_MIN_CHARS`, `SOURCE_MAX_CHARS`, `MAX_ASSETS_PER_REQUEST` | Free-beta limits |
| backend/.env | `OPENAI_INPUT_COST_PER_1M`, `OPENAI_OUTPUT_COST_PER_1M` | Optional, for cost estimates |
| backend/.env | `CORS_ORIGINS` | Allowed frontend origins |
| frontend/.env.local | `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser config |

Never put secret keys in `frontend/.env.local` - everything there ends up in the browser.

### Switching between demo and real AI
In `backend/.env` set `AI_PROVIDER=mock` (free) or `AI_PROVIDER=openai` (uses credits) and restart uvicorn.
Demo assets show an amber **Demo output** badge and are stored with `provider = mock`.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Service status + active AI provider |
| GET / PUT | `/creator-profile` | Load / create-or-update profile (+ platform preferences) |
| GET | `/usage` | Today's AI calls vs the daily limit |
| POST / GET | `/projects` | Create (saved as `draft`) / list with asset counts |
| GET | `/projects/{id}` | Project + all generated content |
| PUT | `/projects/{id}/analysis` | Save user corrections to the brief |
| POST | `/projects/{id}/analyze` | Create the Content Brief |
| POST | `/projects/{id}/ideas` | Add 10 content ideas |
| POST | `/projects/{id}/generate` | `{"outputs":[{"type":"reel","count":3},…],"idea_indexes":[…]}` |
| PATCH | `/content/{id}` | Edit content (old version kept) and/or set status |
| POST | `/content/{id}/rewrite` | `{"instruction":"stronger_hook"}` |
| POST | `/content/{id}/feedback` | `{"rating":"down","reason":"weak_hook","note":"…"}` |

All routes except `/health` need `Authorization: Bearer <Supabase access token>`.
Project status: `draft → analyzing → analyzed → generating → ready`, or `failed` with `error_message`.

## Testing

```powershell
cd backend
.venv\Scripts\activate
pytest                          # unit, pipeline, security & limit tests (no network, no cost)
python scripts/run_golden.py    # benchmark inputs -> golden/outputs/<timestamp>/ (uses AI_PROVIDER)

cd ..\frontend
npm run lint
npm run build
```

`run_golden.py` with `AI_PROVIDER=openai` makes 25 AI calls - run it after prompt or model changes and compare outputs.

## Known limitations

- Generation is synchronous (the request waits, up to ~1 min for 6 assets). Background jobs are a V2 item.
- The per-minute rate limiter is in memory (per backend process); the daily limit is stored in the database.
- Token cost is only estimated if you set the per-1M-token prices.
- Text projects take pasted text only; video/audio files go through AI Video-to-Reels (below). YouTube and other platform links are intentionally not downloaded.
- Feedback is collected but not yet used to adapt generation (by design: collect data first).
- Production deployment (Vercel + Render/Railway) is not set up yet; set `CORS_ORIGINS` to your real domain when deploying.

---

## AI Video-to-Reels Generator

Turn a long-form video into up to **10 vertical (9:16) short clips** with burned-in subtitles, plus a hook,
caption, hashtags, CTA and the reason each moment was chosen.

### Workflow
**New project** → choose a source:

| Source | What you get |
|---|---|
| **Upload video** (.mp4 .mov .m4v .webm .mkv) | Transcript + AI-selected moments + **rendered MP4 clips** you can preview and download |
| **Video link** | Same as upload, for a **direct https link to a media file you own** (e.g. your CDN/cloud storage, ending in .mp4 …) |
| **Audio upload** (.mp3 .m4a .wav .aac .ogg .flac) | Transcript + timestamped clip **suggestions** (no video is rendered) |
| **Text content** | The existing text pipeline (brief → ideas → Reels/LinkedIn/Carousel) |

Processing runs in the background with live status: `queued → downloading (links) → transcribing → selecting → rendering → completed` (or `failed` with a reason and a **Retry** that resumes from the failed step).
In the clip view you can edit title, hook, caption, hashtags, CTA and start/end times. Changing times marks the
old video as outdated, and **Render video** produces the new one. **Use transcript for posts** sends the transcript
into the existing text pipeline.

**Suggestions are never shown as videos:** a clip only offers preview/download when an MP4 was actually rendered.

### Why YouTube / Instagram / TikTok links are not supported
Those platforms do not permit downloading by third-party tools, so the app never scrapes them. Download your own
video from the platform's creator tools (e.g. YouTube Studio → Content → ⋮ → Download) and use **Upload video**.
Link downloads are https-only, size-capped, re-check every redirect, and block private/local network addresses.

### How it works
```
upload / link ──> backend/media_storage/<user>/<video>/source.*      (stays on the backend disk)
      │
      ├─ ffprobe: duration, video/audio streams
      ├─ faster-whisper (local, free): timestamped transcript + word timings
      ├─ llm_service (AI_PROVIDER): pick the strongest self-contained moments
      │     └─ enforced in code: whole sentences only, length limits, no overlap,
      │        transcript excerpt copied from the real transcript
      ├─ FFmpeg: 720x1280 H.264 + AAC 192k, blurred-background "fit" (or "crop"),
      │        word-timed subtitles (ASS/libass)
      └─ upload MP4 to private Supabase Storage bucket "video-clips"
         at <user_id>/<video_id>/<clip_id>.mp4  → temporary signed links for preview/download
```
In `AI_PROVIDER=mock` mode, transcription and rendering are **real**; only clip choice and captions use simple
rules and are labelled **Demo output**.

### Video-to-Reels setup
1. **Database:** Supabase → SQL Editor → run `supabase/migrations/002_video_to_reels.sql`.
   It only creates `video_sources`, `video_clips` (owner-only RLS) and the private `video-clips` storage bucket
   (50 MB/file, MP4 only, per-user folder policies). Nothing existing is changed.
2. **FFmpeg** (free): `winget install Gyan.FFmpeg`, then open a **new** terminal so `ffmpeg` is on PATH
   (or set `FFMPEG_PATH` / `FFPROBE_PATH` in backend/.env to the full .exe paths).
3. **Python packages:** `pip install -r requirements.txt` (adds faster-whisper). The speech model
   (~150 MB for `base`) downloads automatically the first time a video is transcribed.

Optional settings in `backend/.env` (defaults shown):

| Variable | Default | Purpose |
|---|---|---|
| `WHISPER_MODEL` | `base` | `tiny` (fastest) · `base` · `small` · `medium` (most accurate, slower) |
| `WHISPER_COMPUTE_TYPE` | `int8` | CPU-friendly precision |
| `VIDEO_MAX_UPLOAD_MB` | `2048` | Upload size limit |
| `VIDEO_MAX_URL_DOWNLOAD_MB` | `1024` | Link download size limit |
| `VIDEO_MAX_DURATION_MINUTES` | `180` | Longest accepted recording |
| `CLIP_MIN_SECONDS` / `CLIP_MAX_SECONDS` | `15` / `90` | Clip length limits |
| `VIDEO_FRAME_MODE` | `fit` | `fit` = whole frame over blurred background, `crop` = fill by centre-crop |
| `VIDEO_MEDIA_DIR` | `backend/media_storage` | Where source files are kept (git-ignored) |
| `FFMPEG_PATH` / `FFPROBE_PATH` | found on PATH | Explicit tool locations |

### Video API
| Method | Route | Purpose |
|---|---|---|
| GET | `/videos/capabilities` | Is transcription / FFmpeg installed? Limits and formats |
| GET | `/videos` | List video projects with clip counts |
| POST | `/videos/upload` | multipart: `file`, `title`, `clip_count` (1-10), `kind` (`video`/`audio`) |
| POST | `/videos/from-url` | `{"title","url","clip_count"}` (direct media links only) |
| GET | `/videos/{id}` | Status, transcript, clips (+ signed preview/download links for rendered clips) |
| POST | `/videos/{id}/retry` | Resume a failed job |
| POST | `/videos/{id}/text-project` | Create a text project from the transcript |
| PATCH | `/video-clips/{id}` | Edit clip text / timestamps |
| POST | `/video-clips/{id}/render` | (Re-)render one clip |

### Video-to-Reels limitations
- Processing runs on the backend machine's CPU, one video at a time (max 2 queued per user). Roughly: transcription
  ~5-10x faster than real time with `base`; rendering a few seconds per clip.
- Jobs run inside the backend process. If the backend restarts mid-job, the video shows "interrupted" and **Retry** continues.
- Background jobs act with the user's session token (about 1 hour). Very long jobs may need a Retry after signing in again.
- Source files stay on the backend disk (needed for re-rendering) and are not deleted automatically.
  For deployment you would move them to object storage and the jobs to a worker queue.
- Rendered clips must be under 50 MB (Supabase free tier); the bitrate cap keeps 90-second clips well below that.
- Subtitles use Arial; Devanagari text relies on Windows font fallback.

---

## YouTube video links

Paste a YouTube link (`youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…`, `youtube.com/live/…`,
`youtube.com/embed/…`). The backend extracts and validates the video ID, then shows the **official embedded
player**, title, channel and thumbnail. **The video is never downloaded.**

### What a YouTube link can and cannot do
| You provide | You get |
|---|---|
| YouTube link + transcript (captions via Google sign-in, or pasted) | AI-selected clip moments: title, start/end, duration, hook, excerpt, caption, hashtags, CTA, reason. Each clip can be previewed in YouTube's player at its exact timestamps. **No MP4 files.** |
| YouTube link + your **original video file** attached | Everything above **plus real 9:16 MP4 clips** with subtitles, previews and downloads (render all or only selected clips) |

YouTube's terms don't allow apps to download videos, so downloadable MP4s always need the original file. Get it from
**YouTube Studio → Content → hover the video → ⋮ Options → Download**. The app checks that the attached file's length
matches the YouTube video (when duration is known) and that the transcript fits inside it, so clip times line up.

### Transcript options for a YouTube project
1. **Get captions from YouTube** (Sign in with Google): uses the official YouTube Data API `captions.list` +
   `captions.download` with the creator's OAuth token (scope `youtube.force-ssl`). YouTube only allows this for
   videos the signed-in account **owns or can edit**. The token is used once and never stored or logged.
2. **Paste transcript**: on YouTube, "…more" → **Show transcript** → copy the timestamped lines. SRT/VTT files also
   work. Text without timestamps is rejected, so clip times are never invented.
3. **Upload the original video**: transcribed locally (free) and rendered.

Not used, by design: `yt-dlp`, `youtube-transcript-api`, watch-page scraping or any unofficial endpoint.

### YouTube setup (optional, free)
Without any setup, YouTube links work with **oEmbed** previews (no duration shown) plus pasted transcripts and
attached originals. Two optional additions, both from the same free Google Cloud project:

**A. Data API key** (adds duration and better private/unavailable detection; free quota 10,000 units/day, 1 per lookup)
1. Go to https://console.cloud.google.com → project picker → **New project** → create it.
2. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**. Click the key → **API restrictions →
   Restrict key → YouTube Data API v3** → Save.
4. Put it in `backend/.env`: `YOUTUBE_API_KEY=…` and restart the backend. (Never put it in the frontend.)

**B. "Sign in with Google" for captions** (same project, API from step A enabled)
1. **Google Auth Platform** (formerly "OAuth consent screen") → **Get started**: app name, support email,
   Audience **External**, contact email → Create.
2. **Audience → Test users → Add users**: add the Google account(s) that own the YouTube channels you'll test with
   (Testing mode allows up to 100 test users).
3. **Data access → Add or remove scopes** → add `https://www.googleapis.com/auth/youtube.force-ssl` → Save.
4. **Clients → Create client → Web application**. Under **Authorized JavaScript origins** add
   `http://localhost:5173` and `http://127.0.0.1:5173`. No redirect URI is needed.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) into `backend/.env`:
   `GOOGLE_OAUTH_CLIENT_ID=…` and restart the backend. The **client secret is not used**; don't put it anywhere.
6. While in Testing mode Google shows "Google hasn't verified this app" → **Continue**. A public launch requires
   Google's app verification for this sensitive scope.

### Database
Run `supabase/migrations/003_youtube_sources.sql` in the Supabase SQL Editor (after 002). It adds YouTube columns
to `video_sources` and widens two allowed-value lists (`source_kind` + `youtube`, `status` + `awaiting_transcript`).
No data is changed or deleted; the existing owner-only RLS policies cover the new columns.

### FFmpeg on Windows
`winget install Gyan.FFmpeg`. The backend finds FFmpeg on PATH **or** in the usual install folders (winget, `C:\ffmpeg\bin`,
Chocolatey, Scoop), and verifies it by actually running `ffmpeg -version` / `ffprobe -version`. If it's somewhere else, set
`FFMPEG_PATH` and `FFPROBE_PATH` in `backend/.env` to the full `.exe` paths. `GET /videos/capabilities` and the New
Video page show the exact reason when FFmpeg can't be used. YouTube transcript analysis works without FFmpeg; uploading,
attaching originals and rendering need it.

### YouTube API endpoints
| Method | Route | Purpose |
|---|---|---|
| POST | `/youtube/validate` | `{"url"}` → video id, title, channel, thumbnail, duration (with key) |
| POST | `/videos/from-youtube` | `{"url","title?","clip_count"}` → project in `awaiting_transcript` |
| POST | `/videos/{id}/youtube-captions` | `{"access_token"}` (Google sign-in, own videos only) |
| POST | `/videos/{id}/transcript` | `{"text"}` pasted timestamped transcript / SRT / VTT |
| POST | `/videos/{id}/original-file` | multipart `file`: attach the original to render MP4s |
| POST | `/videos/{id}/render` | `{"clip_ids":[…]}` render selected clips |

### YouTube limitations
- Caption download only works for videos the signed-in Google account owns/edits (YouTube rule), and only after you
  complete the Google Cloud setup above. Other people's videos: paste the transcript.
- Without `YOUTUBE_API_KEY`, the duration is unknown until a transcript or file is added, so an attached file that is
  *longer* than the real video can't be detected (shorter ones are).
- YouTube auto-captions have no word timings, so burned-in subtitles are timed per caption line (spread evenly), slightly
  less precise than locally transcribed uploads.
